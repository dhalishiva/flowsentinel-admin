// deno-lint-ignore-file
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify the caller is authenticated in the registry
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Unauthorized' }, 401);

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify the JWT belongs to a valid registry user
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: 'Unauthorized' }, 401);

    const body = await req.json();

    // ── Test email mode ───────────────────────────────────────────────────────
    if (body.test_email) {
      const smtp = await getSmtpConfig(adminClient);
      if (!smtp) return json({ success: false, error: 'SMTP not configured. Go to Settings and save your SMTP details first.' }, 400);
      await sendEmail(smtp, {
        to: body.test_email,
        subject: 'FlowSentinel — SMTP Test',
        html: `<p>This is a test email from FlowSentinel Admin Portal.</p><p>If you received this, your SMTP configuration is working correctly.</p>`,
        text: 'This is a test email from FlowSentinel Admin Portal. If you received this, your SMTP configuration is working correctly.',
      });
      return json({ success: true });
    }

    // ── Reply mode ────────────────────────────────────────────────────────────
    const { ticket_id, reply_text, new_status } = body;
    if (!ticket_id) return json({ success: false, error: 'ticket_id is required' }, 400);

    // Load the ticket
    const { data: ticket, error: ticketErr } = await adminClient
      .from('support_tickets')
      .select('*')
      .eq('id', ticket_id)
      .single();

    if (ticketErr || !ticket) {
      return json({ success: false, error: 'Ticket not found' }, 404);
    }

    // Update ticket in DB
    const updates: Record<string, unknown> = {
      status: new_status || ticket.status,
      updated_at: new Date().toISOString(),
    };
    if (reply_text?.trim()) {
      updates.admin_reply = reply_text.trim();
      updates.replied_at  = new Date().toISOString();
      updates.replied_by  = user.email;
    }

    const { error: updateErr } = await adminClient
      .from('support_tickets')
      .update(updates)
      .eq('id', ticket_id);

    if (updateErr) throw new Error(`Failed to update ticket: ${updateErr.message}`);

    // Send email if there's a reply text
    if (reply_text?.trim()) {
      const smtp = await getSmtpConfig(adminClient);
      if (smtp) {
        const statusLabel = (new_status || ticket.status).replace('_', ' ');
        await sendEmail(smtp, {
          to: ticket.submitted_by_email,
          subject: `Re: [#${ticket_id.slice(0, 8)}] ${ticket.subject}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #4F46E5; padding: 20px 24px; border-radius: 8px 8px 0 0;">
                <h2 style="color: white; margin: 0; font-size: 18px;">FlowSentinel Support</h2>
              </div>
              <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151; margin-top: 0;">Hi ${ticket.submitted_by_name || ticket.submitted_by_email.split('@')[0]},</p>
                <p style="color: #374151;">Thank you for contacting FlowSentinel Support. Here is a reply to your ticket:</p>

                <div style="background: #f8fafc; border-left: 4px solid #4F46E5; padding: 16px; margin: 20px 0; border-radius: 0 4px 4px 0;">
                  <p style="color: #1e293b; margin: 0; white-space: pre-wrap;">${reply_text.trim()}</p>
                </div>

                <p style="color: #6b7280; font-size: 14px;">
                  Ticket status: <strong style="color: #374151; text-transform: capitalize;">${statusLabel}</strong>
                </p>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />

                <p style="color: #9ca3af; font-size: 12px; margin-bottom: 4px;">
                  <strong>Original ticket:</strong> ${ticket.subject}
                </p>
                <p style="color: #9ca3af; font-size: 12px;">
                  <strong>Reference:</strong> #${ticket_id.slice(0, 8)}
                </p>

                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  FlowSentinel — Intelligent Workflow Continuity Monitor<br />
                  <a href="https://app.supportu.cloud" style="color: #4F46E5;">app.supportu.cloud</a>
                </p>
              </div>
            </div>
          `,
          text: `FlowSentinel Support Reply\n\n${reply_text.trim()}\n\nTicket status: ${statusLabel}\nReference: #${ticket_id.slice(0, 8)}`,
        });
      } else {
        console.warn('SMTP not configured — reply saved to DB but email not sent');
      }
    }

    return json({ success: true });

  } catch (err) {
    console.error('send-ticket-reply error:', (err as Error).message);
    return json({ success: false, error: (err as Error).message }, 500);
  }
});

async function getSmtpConfig(adminClient: ReturnType<typeof createClient>) {
  const { data } = await adminClient
    .from('portal_config')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (!data?.smtp_host || !data?.smtp_from_email) return null;
  return data;
}

async function sendEmail(
  smtp: Record<string, unknown>,
  mail: { to: string; subject: string; html: string; text: string }
) {
  const client = new SmtpClient();

  await client.connectTLS({
    hostname: smtp.smtp_host as string,
    port: (smtp.smtp_port as number) || 587,
    username: smtp.smtp_username as string,
    password: smtp.smtp_password as string,
  });

  await client.send({
    from: `${smtp.smtp_from_name} <${smtp.smtp_from_email}>`,
    to: mail.to,
    subject: mail.subject,
    content: mail.text,
    html: mail.html,
  });

  await client.close();
}
