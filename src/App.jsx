import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Building2, Key, Ticket,
  Settings, LogOut, Menu, X, Shield, RefreshCw,
} from 'lucide-react'
import { supabase } from './lib/supabase'
import LoginPage     from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TenantsPage   from './pages/TenantsPage'
import TenantDetailPage from './pages/TenantDetailPage'
import LicensesPage  from './pages/LicensesPage'
import TicketsPage   from './pages/TicketsPage'
import SettingsPage  from './pages/SettingsPage'

export default function App() {
  const [session, setSession]   = useState(undefined) // undefined = loading
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location  = useLocation()
  const navigate  = useNavigate()
  const initialised = useRef(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      initialised.current = true
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'TOKEN_REFRESHED') return
      setSession(s)
    })
    return () => listener?.subscription?.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <RefreshCw className="animate-spin text-indigo-500" size={32} />
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={s => setSession(s)} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    navigate('/login')
  }

  const navItems = [
    { path: '/',         label: 'Dashboard', icon: LayoutDashboard },
    { path: '/tenants',  label: 'Tenants',   icon: Building2 },
    { path: '/licenses', label: 'Licenses',  icon: Key },
    { path: '/tickets',  label: 'Tickets',   icon: Ticket },
    { path: '/settings', label: 'Settings',  icon: Settings },
  ]

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div>
            {/* <span className="font-semibold text-white text-sm">FlowSentinel</span> */}
            <img src="/logo-dark.svg" alt="FlowSentinel" className="h-10" />
            <span className="block text-[10px] text-indigo-400 font-medium tracking-wide uppercase">Admin</span>
          </div>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive(item.path)
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <item.icon size={16} className="shrink-0" />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {session.user.email?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{session.user.email}</p>
            <p className="text-[10px] text-slate-500">Super admin</p>
          </div>
          <button onClick={handleSignOut} title="Sign out"
            className="text-slate-500 hover:text-red-400 transition-colors">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-200 lg:hidden ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-slate-900 border-r border-slate-800 shrink-0">
        <SidebarContent />
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
            <Menu size={20} />
          </button>
          <img src="/logo-dark.svg" alt="FlowSentinel" className="h-10" />
        </header>

        {/* Page */}
        <main className="flex-1 overflow-auto bg-slate-950">
          <Routes>
            <Route path="/"               element={<DashboardPage />} />
            <Route path="/tenants"        element={<TenantsPage />} />
            <Route path="/tenants/:id"    element={<TenantDetailPage />} />
            <Route path="/licenses"       element={<LicensesPage />} />
            <Route path="/tickets"        element={<TicketsPage />} />
            <Route path="/settings"       element={<SettingsPage />} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
