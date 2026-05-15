import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Building2, ArrowRight, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, daysUntil } from '../lib/dateUtils'

export default function TenantsPage() {
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all') // all | active | inactive

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('tenants')
      .select(`
        id, company_name, company_code, contact_email, contact_name,
        is_active, created_at,
        licenses(id, license_type, max_mailboxes, expires_at, is_active, activated_at)
      `)
      .order('created_at', { ascending: false })
    setTenants(data || [])
    setLoading(false)
  }

  const filtered = tenants.filter(t => {
    const matchSearch = !search ||
      t.company_name.toLowerCase().includes(search.toLowerCase()) ||
      t.company_code.toLowerCase().includes(search.toLowerCase()) ||
      t.contact_email?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' ||
      (filter === 'active' && t.is_active) ||
      (filter === 'inactive' && !t.is_active)
    return matchSearch && matchFilter
  })

  const getActiveLicense = (licenses) =>
    (licenses || []).find(l => l.is_active && new Date(l.expires_at) > new Date())

  const getLicenseStatus = (lic) => {
    if (!lic) return { label: 'No license', color: 'text-slate-500 bg-slate-800' }
    const days = daysUntil(lic.expires_at)
    if (days <= 7)  return { label: `${days}d left`, color: 'text-red-400 bg-red-900/30' }
    if (days <= 30) return { label: `${days}d left`, color: 'text-amber-400 bg-amber-900/30' }
    return { label: `${days}d left`, color: 'text-emerald-400 bg-emerald-900/30' }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Tenants</h1>
          <p className="text-slate-400 text-sm mt-0.5">{tenants.length} total clients</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text" placeholder="Search by name, code, or email..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-lg outline-none focus:border-indigo-500 text-sm placeholder-slate-500"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'active', 'inactive'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
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
          <div className="p-12 text-center text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={32} className="mx-auto text-slate-700 mb-3" />
            <p className="text-slate-400">No tenants found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  {['Company', 'Code', 'License', 'Contact', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filtered.map(t => {
                  const lic = getActiveLicense(t.licenses)
                  const licStatus = getLicenseStatus(lic)
                  return (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-medium text-white text-sm">{t.company_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{formatDate(t.created_at)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-sm text-indigo-300 bg-indigo-900/20 px-2 py-0.5 rounded">
                          {t.company_code}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {lic ? (
                          <div>
                            <p className="text-sm text-white capitalize">{lic.license_type}</p>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${licStatus.color}`}>
                              {licStatus.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">No license</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm text-slate-300 truncate max-w-[180px]">{t.contact_email || '—'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${
                          t.is_active
                            ? 'text-emerald-400 bg-emerald-900/30'
                            : 'text-slate-500 bg-slate-800'
                        }`}>
                          {t.is_active
                            ? <><CheckCircle size={11} /> Active</>
                            : <><XCircle size={11} /> Inactive</>
                          }
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link to={`/tenants/${t.id}`}
                          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                          View <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
