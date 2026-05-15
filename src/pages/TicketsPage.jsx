import { useEffect, useState } from 'react'
import {
  Ticket, Search, Send, X, RefreshCw,
  ChevronDown, MessageSquare, Clock, CheckCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatFull, timeAgo } from '../lib/dateUtils'

const STATUS_COLORS = {
  open:        'text-blue-400 bg-blue-900/30 border-blue-800/50',
  in_progress: 'text-amber-400 bg-amber-900/30 border-amber-800/50',
  resolved:    'text-emerald-400 bg-emerald-900/30 border-emerald-800/50',
  closed:      'text-slate-500 bg-slate-800 border-slate-700',
}
const PRIORITY_COLORS = {
  low:      'text-slate-400 bg-slate-800',
  medium:   'text-amber-400 bg-amber-900/30',
  high:     'text-orange-400 bg-orange-900/30',
  critical: 'text-red-400 bg-red-900/30',
}

export default function TicketsPage() {
  const [tickets, setTickets]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState(null)
  const [replyText, setReplyText]   = useState('')
  const [newStatus, setNewStatus]   = useState('')
  const [sending, setSending]       = useState(false)
  const [sendMsg, setSendMsg]       = useState(null)
  const [search, setSearch]         = useState('')
  const [filterStatus, setFilterStatus] = useState('open')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
    setTickets(data || [])
    setLoading(false)
  }

  const openTicket = (t) => {
    setSelected(t)
    setReplyText('')
    setNewStatus(t.status)
    setSendMsg(null)
  }

  const filtered = tickets.filter(t => {
    const matchSearch = !search ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.company_code.toLowerCase().includes(search.toLowerCase()) ||
      t.submitted_by_email.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || t.status === filterStatus
    return matchSearch && matchStatus
  })

  const handleReply = async () => {
    if (!replyText.trim() && newStatus === selected.status) return
    setSending(true)
    setSendMsg(null)

    try {
      // 1. Call the send-ticket-reply Edge Function (handles email + DB update)
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(
        `${import.meta.env.VITE_REGISTRY_URL}/functions/v1/send-ticket-reply`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_REGISTRY_ANON_KEY,
          },
          body: JSON.stringify({
            ticket_id:  selected.id,
            reply_text: replyText.trim(),
            new_status: newStatus,
          }),
        }
      )

      const result = await res.json()
      if (!res.ok || result.success === false) {
        throw new Error(result.error || 'Failed to send reply')
      }

      setSendMsg({ type: 'success', text: replyText.trim() ? 'Reply sent and email delivered.' : 'Status updated.' })
      setReplyText('')

      // Refresh tickets
      await load()

      // Update selected with latest data
      const updated = tickets.find(t => t.id === selected.id)
      if (updated) setSelected({ ...updated, status: newStatus, admin_reply: replyText.trim(), replied_at: new Date().toISOString() })

    } catch (err) {
      setSendMsg({ type: 'error', text: err.message })
    } finally {
      setSending(false)
    }
  }

  const counts = {
    open:        tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved:    tickets.filter(t => t.status === 'resolved').length,
    all:         tickets.length,
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Support Tickets</h1>
        <p className="text-slate-400 text-sm mt-0.5">{tickets.length} total tickets</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Search tickets..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm placeholder-slate-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'open', label: `Open (${counts.open})` },
            { key: 'in_progress', label: `In Progress (${counts.in_progress})` },
            { key: 'resolved', label: `Resolved (${counts.resolved})` },
            { key: 'all', label: `All (${counts.all})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterStatus === f.key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-5">
        {/* Ticket list */}
        <div className={`bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex-1 ${selected ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="p-12 text-center text-slate-500">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Ticket size={32} className="mx-auto text-slate-700 mb-3" />
              <p className="text-slate-400 text-sm">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filtered.map(t => (
                <button key={t.id} onClick={() => openTicket(t)}
                  className={`w-full text-left px-5 py-4 hover:bg-slate-800/50 transition-colors ${
                    selected?.id === t.id ? 'bg-slate-800/70 border-l-2 border-indigo-500' : ''
                  }`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${PRIORITY_COLORS[t.priority]}`}>
                        {t.priority}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${STATUS_COLORS[t.status]}`}>
                        {t.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{t.company_code}</span>
                    </div>
                    <span className="text-xs text-slate-500 shrink-0">{timeAgo(t.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">{t.subject}</p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">{t.submitted_by_email}</p>
                  {t.admin_reply && (
                    <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle size={10} /> Replied {timeAgo(t.replied_at)}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ticket detail */}
        {selected && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl flex-1 lg:max-w-lg flex flex-col">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white leading-snug">{selected.subject}</h2>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${PRIORITY_COLORS[selected.priority]}`}>
                    {selected.priority}
                  </span>
                  <span className="text-xs text-slate-500">{selected.company_code}</span>
                  <span className="text-xs text-slate-500">{formatFull(selected.created_at)}</span>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-white shrink-0 lg:hidden">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Submitted by */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                    {selected.submitted_by_email[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-white">{selected.submitted_by_name || selected.submitted_by_email}</p>
                    <p className="text-[10px] text-slate-500">{selected.submitted_by_email}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${PRIORITY_COLORS[selected.category] || 'text-slate-400 bg-slate-700'}`}>
                      {selected.category}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {/* Previous reply */}
              {selected.admin_reply && (
                <div className="bg-indigo-900/20 border border-indigo-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-indigo-700 flex items-center justify-center shrink-0">
                      <MessageSquare size={12} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-indigo-300">FlowSentinel Support</p>
                      <p className="text-[10px] text-slate-500">{formatFull(selected.replied_at)}</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{selected.admin_reply}</p>
                </div>
              )}
            </div>

            {/* Reply box */}
            <div className="p-4 border-t border-slate-800 space-y-3">
              {/* Status change */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500 shrink-0">Status:</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-xs">
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Reply text */}
              <textarea
                rows={4}
                placeholder="Type your reply... (leave blank to only update status)"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm placeholder-slate-600 resize-none"
              />

              {sendMsg && (
                <p className={`text-xs px-3 py-2 rounded-lg ${
                  sendMsg.type === 'success'
                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
                    : 'bg-red-900/30 text-red-400 border border-red-800/50'
                }`}>
                  {sendMsg.type === 'success' ? '✓ ' : '✗ '}{sendMsg.text}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleReply}
                  disabled={sending || (!replyText.trim() && newStatus === selected.status)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {sending
                    ? <RefreshCw className="animate-spin" size={14} />
                    : <><Send size={13} /> {replyText.trim() ? 'Send reply' : 'Update status'}</>
                  }
                </button>
              </div>
              <p className="text-[10px] text-slate-600 text-center">
                Reply will be saved to database and emailed to {selected.submitted_by_email}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
