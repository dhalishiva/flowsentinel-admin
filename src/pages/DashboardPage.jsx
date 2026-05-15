import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Building2, Key, Ticket, AlertTriangle,
  TrendingUp, CheckCircle, Clock, ArrowRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, daysUntil, timeAgo } from '../lib/dateUtils'

export default function DashboardPage() {
  const [stats, setStats]               = useState(null)
  const [expiringLicenses, setExpiring] = useState([])
  const [recentTickets, setTickets]     = useState([])
  const [recentTenants, setTenants]     = useState([])
  const [loading, setLoading]           = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [tenantsRes, licensesRes, ticketsRes] = await Promise.all([
      supabase.from('tenants').select('id, is_active'),
      supabase.from('licenses').select('id, expires_at, is_active, tenant_id'),
      supabase.from('support_tickets').select('id, status'),
    ])

    const tenants  = tenantsRes.data  || []
    const licenses = licensesRes.data || []
    const tickets  = ticketsRes.data  || []
    const now = new Date()
    const in30 = new Date(now.getTime() + 30 * 86400000)

    setStats({
      totalTenants:   tenants.length,
      activeTenants:  tenants.filter(t => t.is_active).length,
      totalLicenses:  licenses.length,
      expiringSoon:   licenses.filter(l => l.is_active && new Date(l.expires_at) <= in30 && new Date(l.expires_at) > now).length,
      openTickets:    tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length,
      totalTickets:   tickets.length,
    })

    // Expiring licenses in next 60 days
    const { data: expiring } = await supabase
      .from('licenses')
      .select('id, expires_at, license_type, max_mailboxes, tenant_id, tenants(company_name, company_code)')
      .eq('is_active', true)
      .gte('expires_at', now.toISOString())
      .lte('expires_at', new Date(now.getTime() + 60 * 86400000).toISOString())
      .order('expires_at', { ascending: true })
      .limit(5)
    setExpiring(expiring || [])

    // Recent open tickets
    const { data: recentT } = await supabase
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, company_code')
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(5)
    setTickets(recentT || [])

    // Recent tenants
    const { data: recentTen } = await supabase
      .from('tenants')
      .select('id, company_name, company_code, created_at, is_active')
      .order('created_at', { ascending: false })
      .limit(5)
    setTenants(recentTen || [])

    setLoading(false)
  }

  const StatCard = ({ icon: Icon, label, value, sub, color = 'indigo' }) => {
    const colors = {
      indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      red: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-2 rounded-lg border ${colors[color]}`}>
            <Icon size={18} />
          </div>
        </div>
        <p className="text-2xl font-bold text-white mb-1">{value ?? '—'}</p>
        <p className="text-sm font-medium text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    )
  }

  const priorityColors = {
    low: 'text-slate-400 bg-slate-800',
    medium: 'text-amber-400 bg-amber-900/30',
    high: 'text-orange-400 bg-orange-900/30',
    critical: 'text-red-400 bg-red-900/30',
  }
  const statusColors = {
    open: 'text-blue-400 bg-blue-900/30',
    in_progress: 'text-amber-400 bg-amber-900/30',
    resolved: 'text-emerald-400 bg-emerald-900/30',
    closed: 'text-slate-400 bg-slate-800',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-0.5">FlowSentinel business overview</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={Building2} label="Active Tenants" value={stats?.activeTenants}
              sub={`${stats?.totalTenants} total`} color="indigo" />
            <StatCard icon={Key} label="Active Licenses" value={stats?.totalLicenses}
              sub={stats?.expiringSoon > 0 ? `${stats.expiringSoon} expiring soon` : 'All good'} color="emerald" />
            <StatCard icon={AlertTriangle} label="Expiring in 30d" value={stats?.expiringSoon}
              color={stats?.expiringSoon > 0 ? 'amber' : 'emerald'} />
            <StatCard icon={Ticket} label="Open Tickets" value={stats?.openTickets}
              sub={`${stats?.totalTickets} total`}
              color={stats?.openTickets > 0 ? 'red' : 'emerald'} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Expiring licenses */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-semibold text-white text-sm">Expiring Licenses</h2>
                <Link to="/licenses" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-slate-800">
                {expiringLicenses.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <CheckCircle size={24} className="mx-auto text-emerald-500 mb-2" />
                    <p className="text-slate-400 text-sm">No licenses expiring soon</p>
                  </div>
                ) : expiringLicenses.map(lic => {
                  const days = daysUntil(lic.expires_at)
                  return (
                    <div key={lic.id} className="px-5 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {lic.tenants?.company_name ?? '—'}
                        </p>
                        <p className="text-xs text-slate-500">{lic.license_type} · {lic.max_mailboxes} mailboxes</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                        days <= 7 ? 'bg-red-900/40 text-red-400' :
                        days <= 30 ? 'bg-amber-900/40 text-amber-400' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {days}d left
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Open tickets */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-semibold text-white text-sm">Open Tickets</h2>
                <Link to="/tickets" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-slate-800">
                {recentTickets.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <CheckCircle size={24} className="mx-auto text-emerald-500 mb-2" />
                    <p className="text-slate-400 text-sm">No open tickets</p>
                  </div>
                ) : recentTickets.map(t => (
                  <Link key={t.id} to="/tickets"
                    className="block px-5 py-3 hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase ${priorityColors[t.priority]}`}>
                        {t.priority}
                      </span>
                      <span className="text-xs text-slate-500">{t.company_code}</span>
                    </div>
                    <p className="text-sm text-white truncate">{t.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{timeAgo(t.created_at)}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent tenants */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-semibold text-white text-sm">Recent Tenants</h2>
                <Link to="/tenants" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  View all <ArrowRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-slate-800">
                {recentTenants.map(t => (
                  <Link key={t.id} to={`/tenants/${t.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{t.company_name}</p>
                      <p className="text-xs text-slate-500 font-mono">{t.company_code}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${t.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                      <span className="text-xs text-slate-500">{timeAgo(t.created_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
