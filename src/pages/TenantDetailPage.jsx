import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Building2, Key, Ticket, ExternalLink,
  CheckCircle, XCircle, AlertTriangle, RefreshCw, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, formatFull, daysUntil, timeAgo } from '../lib/dateUtils'

export default function TenantDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tenant, setTenant]   = useState(null)
  const [licenses, setLicenses] = useState([])
  const [tickets, setTickets]  = useState([])
  const [loading, setLoading]  = useState(true)
  const [toggling, setToggling] = useState(false)

  useEffect(() => { load() }, [id])

  const load = async () => {
    setLoading(true)
    const [tenantRes, licRes, tickRes] = await Promise.all([
      supabase.from('tenants').select('*').eq('id', id).single(),
      supabase.from('licenses').select('*').eq('tenant_id', id).order('created_at', { ascending: false }),
      supabase.from('support_tickets').select('*').eq('tenant_id', id).order('created_at', { ascending: false }).limit(10),
    ])
    setTenant(tenantRes.data)
    setLicenses(licRes.data || [])
    setTickets(tickRes.data || [])
    setLoading(false)
  }

  const toggleActive = async () => {
    if (!confirm(`${tenant.is_active ? 'Deactivate' : 'Activate'} ${tenant.company_name}?`)) return
    setToggling(true)
    await supabase.from('tenants').update({ is_active: !tenant.is_active }).eq('id', id)
    await load()
    setToggling(false)
  }

  const revokeLicense = async (licId) => {
    if (!confirm('Revoke this license? The tenant will not be able to log in.')) return
    await supabase.from('licenses').update({ is_active: false }).eq('id', licId)
    await load()
  }

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <RefreshCw className="animate-spin text-indigo-500" size={24} />
    </div>
  )

  if (!tenant) return (
    <div className="p-6 text-center text-slate-400">Tenant not found.</div>
  )

  const activeLic = licenses.find(l => l.is_active && new Date(l.expires_at) > new Date())
  const statusColors = {
    open: 'text-blue-400 bg-blue-900/30',
    in_progress: 'text-amber-400 bg-amber-900/30',
    resolved: 'text-emerald-400 bg-emerald-900/30',
    closed: 'text-slate-500 bg-slate-800',
  }
  const priorityColors = {
    low: 'text-slate-400', medium: 'text-amber-400',
    high: 'text-orange-400', critical: 'text-red-400',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Back */}
      <Link to="/tenants" className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-5 transition-colors">
        <ArrowLeft size={15} /> Back to tenants
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-indigo-900/40 border border-indigo-800/50 rounded-xl flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{tenant.company_name}</h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="font-mono text-xs text-indigo-300 bg-indigo-900/20 px-2 py-0.5 rounded">
                {tenant.company_code}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                tenant.is_active ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {tenant.is_active ? <CheckCircle size={11} /> : <XCircle size={11} />}
                {tenant.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={toggleActive} disabled={toggling}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
            tenant.is_active
              ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/50'
              : 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-800/50'
          }`}
        >
          {toggling ? <RefreshCw className="animate-spin" size={14} /> :
            tenant.is_active ? 'Deactivate tenant' : 'Activate tenant'}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tenant info */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Tenant Information</h2>
          <div className="space-y-3">
            {[
              ['Company name', tenant.company_name],
              ['Company code', tenant.company_code],
              ['Contact email', tenant.contact_email || '—'],
              ['Contact name', tenant.contact_name || '—'],
              ['Supabase URL', tenant.supabase_url],
              ['Created', formatFull(tenant.created_at)],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <span className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{label}</span>
                <span className="text-sm text-slate-200 break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Active license */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Key size={14} className="text-indigo-400" /> Active License
          </h2>
          {activeLic ? (
            <div className="space-y-3">
              {[
                ['Type', <span className="capitalize">{activeLic.license_type}</span>],
                ['Max mailboxes', activeLic.max_mailboxes],
                ['Expires', formatDate(activeLic.expires_at)],
                ['Days remaining', (() => {
                  const d = daysUntil(activeLic.expires_at)
                  return (
                    <span className={d <= 30 ? 'text-amber-400 font-semibold' : 'text-emerald-400'}>
                      {d} days
                    </span>
                  )
                })()],
                ['Activated', formatFull(activeLic.activated_at)],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-3">
                  <span className="text-xs text-slate-500 w-28 shrink-0 pt-0.5">{label}</span>
                  <span className="text-sm text-slate-200">{value}</span>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-800">
                <button onClick={() => revokeLicense(activeLic.id)}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                  <Trash2 size={12} /> Revoke license
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
              <p className="text-slate-400 text-sm">No active license</p>
            </div>
          )}
        </div>
      </div>

      {/* License history */}
      {licenses.length > 1 && (
        <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="px-5 py-4 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-white">License History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Type', 'Mailboxes', 'Expires', 'Status'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {licenses.map(l => (
                  <tr key={l.id} className="text-sm">
                    <td className="px-5 py-3 text-slate-300 capitalize">{l.license_type}</td>
                    <td className="px-5 py-3 text-slate-300">{l.max_mailboxes}</td>
                    <td className="px-5 py-3 text-slate-300">{formatDate(l.expires_at)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        l.is_active && new Date(l.expires_at) > new Date()
                          ? 'text-emerald-400 bg-emerald-900/30'
                          : 'text-slate-500 bg-slate-800'
                      }`}>
                        {l.is_active && new Date(l.expires_at) > new Date() ? 'Active' :
                         !l.is_active ? 'Revoked' : 'Expired'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent tickets */}
      <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Ticket size={14} className="text-indigo-400" /> Support Tickets
          </h2>
          <Link to="/tickets" className="text-xs text-indigo-400 hover:text-indigo-300">View all →</Link>
        </div>
        {tickets.length === 0 ? (
          <div className="px-5 py-8 text-center text-slate-500 text-sm">No tickets from this tenant</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {tickets.map(t => (
              <Link key={t.id} to="/tickets"
                className="block px-5 py-3 hover:bg-slate-800/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase ${priorityColors[t.priority]}`}>
                    {t.priority}
                  </span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusColors[t.status]}`}>
                    {t.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto">{timeAgo(t.created_at)}</span>
                </div>
                <p className="text-sm text-white">{t.subject}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
