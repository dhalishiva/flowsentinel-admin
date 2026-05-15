import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Building2, ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, daysUntil } from '../lib/dateUtils'

export default function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading]  = useState(true)
  const [search, setSearch]    = useState('')
  const [filter, setFilter]    = useState('all')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tenants')
      .select(`
        id, company_name, company_code, contact_email,
        is_active, created_at,
        licenses(id, license_type, max_mailboxes, expires_at, is_active)
      `)
      .order('created_at', { ascending: false })
    setTenants(data || [])
    setLoading(false)
  }

  const filtered = tenants.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      t.company_name.toLowerCase().includes(q) ||
      t.company_code.toLowerCase().includes(q) ||
      t.contact_email?.toLowerCase().includes(q)
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && t.is_active) ||
      (filter === 'inactive' && !t.is_active)
    return matchSearch && matchFilter
  })

  const getActiveLicense = (licenses) =>
    (licenses || []).find(l => l.is_active && new Date(l.expires_at) > new Date())

  const licBadge = (lic) => {
    if (!lic) return { label: 'None', cls: 'text-slate-500 bg-slate-800' }
    const d = daysUntil(lic.expires_at)
    if (d <= 7)  return { label: `${d}d`, cls: 'text-red-400 bg-red-900/30' }
    if (d <= 30) return { label: `${d}d`, cls: 'text-amber-400 bg-amber-900/30' }
    return { label: `${d}d`, cls: 'text-emerald-400 bg-emerald-900/30' }
  }

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 text-sm mt-0.5">{tenants.length} total clients</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" placeholder="Search..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm placeholder-slate-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'
              }`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={28} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400 text-sm">No tenants found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">License</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(t => {
                const lic    = getActiveLicense(t.licenses)
                const badge  = licBadge(lic)
                return (
                  <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Company */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-white text-sm truncate max-w-[140px]">
                        {t.company_name}
                      </p>
                    </td>

                    {/* Code */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-indigo-300 bg-indigo-900/20 px-2 py-0.5 rounded">
                        {t.company_code}
                      </span>
                    </td>

                    {/* License — hidden on xs */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {lic ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-300 capitalize">{lic.license_type}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>

                    {/* Contact — hidden on sm */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="text-xs text-slate-400 truncate max-w-[160px]">
                        {t.contact_email || '—'}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        t.is_active
                          ? 'text-emerald-400 bg-emerald-900/30'
                          : 'text-slate-500 bg-slate-800'
                      }`}>
                        {t.is_active
                          ? <><CheckCircle size={10} />Active</>
                          : <><XCircle size={10} />Off</>
                        }
                      </span>
                    </td>

                    {/* Created — hidden on md */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-slate-500">{formatDate(t.created_at)}</span>
                    </td>

                    {/* View */}
                    <td className="px-4 py-3 text-right">
                      <Link to={`/tenants/${t.id}`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                        View <ArrowRight size={11} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}