import { useEffect, useState } from 'react'
import { Settings, Save, Send, CheckCircle, XCircle, RefreshCw, Eye, EyeOff, Key } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function SettingsPage() {
  // const [config, setConfig] = useState({
  //   smtp_host: '', smtp_port: 587, smtp_username: '', smtp_password: '',
  //   smtp_from_email: '', smtp_from_name: 'FlowSentinel Support',
  // })
  const [config, setConfig] = useState({
  smtp_host: '',
  smtp_port: 587,
  smtp_username: '',
  smtp_password: '',
  smtp_from_email: '',
  smtp_from_name: 'FlowSentinel Support',
})

  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [saveMsg, setSaveMsg]     = useState(null)
  const [testEmail, setTestEmail] = useState('')
  const [testing, setTesting]     = useState(false)
  const [testMsg, setTestMsg]     = useState(null)
  const [showPass, setShowPass]   = useState(false)

  // HMAC secret management (stored in localStorage only)
  const [hmacSecret, setHmacSecret] = useState(
    localStorage.getItem('fs_admin_hmac_secret') || ''
  )
  const [hmacSaved, setHmacSaved] = useState(false)

  useEffect(() => { loadConfig() }, [])

  const loadConfig = async () => {
    setLoading(true)
    const { data } = await supabase.from('portal_config').select('*').eq('id', 1).maybeSingle()
    if (data) setConfig({
      smtp_host:       data.smtp_host       || '',
      smtp_port:       data.smtp_port       || 587,
      smtp_username:   data.smtp_username   || '',
      smtp_password:   data.smtp_password   || '',
      smtp_from_email: data.smtp_from_email || '',
      smtp_from_name:  data.smtp_from_name  || 'FlowSentinel Support',
    })
    setLoading(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveMsg(null)
    const { error } = await supabase.from('portal_config').upsert({
      id: 1,
      ...config,
      smtp_port: parseInt(config.smtp_port),
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaveMsg(error ? { type: 'error', text: error.message } : { type: 'success', text: 'SMTP settings saved.' })
  }

  const handleTest = async () => {
    if (!testEmail) return
    setTesting(true)
    setTestMsg(null)
    try {
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
          body: JSON.stringify({ test_email: testEmail }),
        }
      )
      const result = await res.json()
      if (!res.ok || result.success === false) throw new Error(result.error || 'Test failed')
      setTestMsg({ type: 'success', text: 'Test email sent successfully.' })
    } catch (err) {
      setTestMsg({ type: 'error', text: err.message })
    } finally { setTesting(false) }
  }

  const saveHmac = () => {
    localStorage.setItem('fs_admin_hmac_secret', hmacSecret)
    setHmacSaved(true)
    setTimeout(() => setHmacSaved(false), 2000)
  }

  const upd = (field) => (e) => setConfig(c => ({ ...c, [field]: e.target.value }))

  const inputCls = "w-full px-3 py-2.5 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm placeholder-slate-600"

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings size={20} className="text-indigo-400" /> Settings
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">Configure portal SMTP and license key signing</p>
      </div>

      {/* SMTP Settings */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-5">
        <h2 className="text-sm font-semibold text-white mb-5">
          SMTP Configuration
          <span className="text-slate-500 font-normal ml-2">— used for ticket reply emails</span>
        </h2>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">SMTP Host</label>
                <input type="text" placeholder="smtp-relay.brevo.com"
                  value={config.smtp_host} onChange={upd('smtp_host')} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Port</label>
                <input type="number" value={config.smtp_port} onChange={upd('smtp_port')} className={inputCls} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Username</label>
                <input type="text" placeholder="your@email.com"
                  value={config.smtp_username} onChange={upd('smtp_username')} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password / API key</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'}
                    value={config.smtp_password} onChange={upd('smtp_password')}
                    className={inputCls + ' pr-10'} />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">From email</label>
                <input type="email" placeholder="support@supportu.cloud"
                  value={config.smtp_from_email} onChange={upd('smtp_from_email')} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">From name</label>
                <input type="text" placeholder="FlowSentinel Support"
                  value={config.smtp_from_name} onChange={upd('smtp_from_name')} className={inputCls} />
              </div>
            </div>

            {saveMsg && (
              <p className={`text-xs px-3 py-2 rounded-lg border ${
                saveMsg.type === 'success'
                  ? 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50'
                  : 'bg-red-900/20 text-red-400 border-red-800/50'
              }`}>
                {saveMsg.text}
              </p>
            )}

            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? <RefreshCw className="animate-spin" size={13} /> : <Save size={13} />}
                Save SMTP settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Test email */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Send size={14} className="text-indigo-400" /> Send Test Email
        </h2>
        <div className="flex gap-2">
          <input type="email" placeholder="recipient@example.com"
            value={testEmail} onChange={e => setTestEmail(e.target.value)}
            className={inputCls + ' flex-1'} />
          <button onClick={handleTest} disabled={testing || !testEmail}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg disabled:opacity-50 transition-colors whitespace-nowrap">
            {testing ? <RefreshCw className="animate-spin" size={14} /> : 'Send test'}
          </button>
        </div>
        {testMsg && (
          <p className={`text-xs mt-3 flex items-center gap-1.5 ${
            testMsg.type === 'success' ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {testMsg.type === 'success' ? <CheckCircle size={12} /> : <XCircle size={12} />}
            {testMsg.text}
          </p>
        )}
      </div>

      {/* HMAC Secret */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
          <Key size={14} className="text-indigo-400" /> License Key HMAC Secret
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Stored in your browser only — never sent to the server. Needed to generate license keys on the Licenses page.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showPass ? 'text' : 'password'}
              placeholder="908102a11b0442cf..."
              value={hmacSecret}
              onChange={e => setHmacSecret(e.target.value)}
              className={inputCls + ' pr-10 font-mono'}
            />
            <button type="button" onClick={() => setShowPass(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <button onClick={saveHmac}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              hmacSaved
                ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/50'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}>
            {hmacSaved ? <><CheckCircle size={13} className="inline mr-1" />Saved</> : 'Save locally'}
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2">
          This is the same secret as LICENSE_HMAC_SECRET in your registry Supabase.
        </p>
      </div>
    </div>
  )
}
