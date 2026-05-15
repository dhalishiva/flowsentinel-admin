import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Key, Copy, Check, RefreshCw, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, daysUntil } from '../lib/dateUtils'

// ── Key generator ─────────────────────────────────────────────────────────────
function toBase64Url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function hmacSha256hex(message, secret) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function generateKey(config, hmacSecret) {
  const now     = new Date()
  const expires = new Date(now.getTime() + config.duration_days * 86400000)
  const payload = JSON.stringify({
    type: config.license_type,
    max_mailboxes: config.max_mailboxes,
    issued_at: now.toISOString(),
    expires_at: expires.toISOString(),
  })
  const payloadB64 = toBase64Url(payload)
  const sig        = await hmacSha256hex(payloadB64, hmacSecret)
  const combined   = payloadB64 + '|' + sig
  const encoded    = toBase64Url(combined)
  const chunks     = encoded.match(/.{1,6}/g) || []
  return { key: 'FS.' + chunks.join('.'), expires }
}

export default function LicensesPage() {
  const [licenses, setLicenses]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [showGen, setShowGen]           = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [generatedKey, setGeneratedKey] = useState(null)
  const [copied, setCopied]             = useState(false)
  const [hmacSecret, setHmacSecret]     = useState(
    localStorage.getItem('fs_admin_hmac_secret') || ''
  )
  const [form, setForm] = useState({
    customer_name: '',
    license_type: 'standard',
    max_mailboxes: 5,
    duration_days: 365,
  })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('licenses')
      .select('*, tenants(company_name, company_code)')
      .order('created_at', { ascending: false })
    setLicenses(data || [])
    setLoading(false)
  }

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!hmacSecret) { alert('Enter your HMAC secret first'); return }
    setGenerating(true)
    try {
      const { key, expires } = await generateKey(form, hmacSecret)
      setGeneratedKey({ key, expires, config: { ...form } })
      localStorage.setItem('fs_admin_hmac_secret', hmacSecret)
    } catch (err) {
      alert('Generation failed: ' + err.message)
    } finally { setGenerating(false) }
  }

  const copyKey = async () => {
    await navigator.clipboard.writeText(generatedKey.key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const licStatusColor = (l) => {
    if (!l.is_active) return 'text-slate-500 bg-slate-800'
    const d = daysUntil(l.expires_at)
    if (d <= 0)  return 'text-slate-500 bg-slate-800'
    if (d <= 7)  return 'text-red-400 bg-red-900/30'
    if (d <= 30) return 'text-amber-400 bg-amber-900/30'
    return 'text-emerald-400 bg-emerald-900/30'
  }

  const licStatusLabel = (l) => {
    if (!l.is_active) return 'Revoked'
    const d = daysUntil(l.expires_at)
    if (d <= 0) return 'Expired'
    return `${d}d`
  }

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Licenses</h1>
          <p className="text-slate-400 text-sm mt-0.5">{licenses.length} issued</p>
        </div>
        <button
          onClick={() => setShowGen(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Generate key
          {showGen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Generator */}
      {showGen && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Key size={14} className="text-indigo-400" /> Generate License Key
          </h2>

          {generatedKey ? (
            <div className="space-y-4">
              <div className="bg-slate-800 border border-indigo-700/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">License Key</p>
                  <button onClick={copyKey}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      copied ? 'bg-emerald-900/40 text-emerald-400' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}>
                    {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
                  </button>
                </div>
                <p className="font-mono text-xs text-indigo-300 break-all leading-relaxed">
                  {generatedKey.key}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  ['Customer', generatedKey.config.customer_name],
                  ['Type', generatedKey.config.license_type],
                  ['Mailboxes', generatedKey.config.max_mailboxes],
                  ['Expires', formatDate(generatedKey.expires)],
                ].map(([k, v]) => (
                  <div key={k} className="bg-slate-800 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-500 mb-0.5">{k}</p>
                    <p className="text-white font-medium capitalize">{String(v)}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setGeneratedKey(null); setForm({ customer_name: '', license_type: 'standard', max_mailboxes: 5, duration_days: 365 }) }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg transition-colors">
                  Generate another
                </button>
                <button onClick={() => { setShowGen(false); setGeneratedKey(null) }}
                  className="px-4 py-2 text-slate-400 text-sm hover:text-white">
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  HMAC Secret <span className="text-slate-600">(saved locally)</span>
                </label>
                <input type="password" required placeholder="908102a11b..."
                  value={hmacSecret} onChange={e => setHmacSecret(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm font-mono placeholder-slate-600"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Customer name</label>
                  <input type="text" required placeholder="Acme Corporation"
                    value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm placeholder-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">License type</label>
                  <select value={form.license_type} onChange={e => setForm(f => ({ ...f, license_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm">
                    <option value="trial">Trial (3 days)</option>
                    <option value="standard">Standard (5 mailboxes)</option>
                    <option value="professional">Professional (15 mailboxes)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Max mailboxes</label>
                  <input type="number" required min={1} max={50}
                    value={form.max_mailboxes} onChange={e => setForm(f => ({ ...f, max_mailboxes: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Duration (days)</label>
                  <div className="flex gap-2">
                    <input type="number" required min={1}
                      value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: parseInt(e.target.value) }))}
                      className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm"
                    />
                    {[3, 365].map(d => (
                      <button key={d} type="button"
                        onClick={() => setForm(f => ({ ...f, duration_days: d }))}
                        className={`px-2 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                          form.duration_days === d
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white'
                        }`}>
                        {d === 3 ? 'Trial' : '1yr'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" disabled={generating}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                {generating ? <RefreshCw className="animate-spin" size={13} /> : <Key size={13} />}
                Generate
              </button>
            </form>
          )}
        </div>
      )}

      {/* Licenses table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading...</div>
        ) : licenses.length === 0 ? (
          <div className="p-12 text-center">
            <Key size={28} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No licenses issued yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tenant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">Mbx</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Expires</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Activated</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {licenses.map(l => (
                <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3">
                    {l.tenants ? (
                      <Link to={`/tenants/${l.tenant_id}`} className="hover:text-indigo-400 transition-colors">
                        <p className="text-sm font-medium text-white truncate max-w-[120px]">{l.tenants.company_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{l.tenants.company_code}</p>
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-500">Not activated</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-slate-300 capitalize">{l.license_type}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-slate-300">{l.max_mailboxes}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-300">{formatDate(l.expires_at)}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-slate-400">{l.activated_at ? formatDate(l.activated_at) : '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${licStatusColor(l)}`}>
                      {licStatusLabel(l)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}