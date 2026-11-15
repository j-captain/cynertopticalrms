import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users as UsersIcon, FileText, LogOut, PlusCircle,
  ShoppingBag, Settings as SettingsIcon, ShieldCheck, UserCircle,
  ChevronsLeft, ChevronsRight, Menu, X, Stethoscope, Building2, UserCog, Database, FolderOpen,
} from 'lucide-react';
import Logo from './Logo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const mainNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/patients', label: 'Patients', icon: UsersIcon },
  { to: '/patients/new', label: 'New Record', icon: PlusCircle },
  { to: '/documents', label: 'Documents', icon: FolderOpen }, 
  { to: '/orders', label: 'Orders', icon: ShoppingBag },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/icd11', label: 'ICD-11 Codes', icon: Stethoscope },
  { to: '/insurance', label: 'Insurance', icon: Building2 },
  { to: '/custom-recipients', label: 'Recipients', icon: UserCog },
];

const adminNav = [
  { to: '/users', label: 'Users', icon: ShieldCheck },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/audit', label: 'Audit Log', icon: FileText },
  { to: '/database', label: 'Database', icon: Database },
];

const STORAGE_KEY = 'cynert_sidebar_collapsed';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const NavItem = ({ to, label, icon: Icon, end }) => (
    <NavLink
      to={to}
      end={end}
      onClick={() => setMobileOpen(false)}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition relative group ${
          isActive
            ? 'bg-gradient-to-r from-sky-500/10 to-indigo-500/10 text-sky-700'
            : 'text-slate-600 hover:bg-slate-50'
        } ${collapsed ? 'justify-center' : ''}`
      }
    >
      <Icon size={18} className="shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-2 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition z-50">
          {label}
        </span>
      )}
    </NavLink>
  );

  const SidebarInner = ({ isMobile = false }) => (
    <>
      <div className={`flex items-center border-b border-slate-100 ${collapsed && !isMobile ? 'justify-center px-2 py-4' : 'px-5 py-5 justify-between'}`}>
        {collapsed && !isMobile ? (
          <img src="/logo.svg" width={32} height={32} alt="Cynert" />
        ) : (
          <Logo />
        )}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        )}
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {mainNav.map((n) => <NavItem key={n.to} {...n} end={n.to === '/'} />)}
        {user?.role === 'admin' && (
          <>
            {!collapsed && (
              <div className="px-3 pt-4 pb-1 text-[10px] uppercase tracking-widest text-slate-400 font-bold">Admin</div>
            )}
            {collapsed && !isMobile && <div className="my-2 border-t border-slate-100" />}
            {adminNav.map((n) => <NavItem key={n.to} {...n} />)}
          </>
        )}
      </nav>

      <div className="p-2 border-t border-slate-100">
        <NavLink
          to="/profile"
          onClick={() => setMobileOpen(false)}
          title={collapsed ? user?.name : undefined}
          className={`flex items-center gap-2 rounded-xl px-2 py-2 hover:bg-slate-50 transition ${collapsed && !isMobile ? 'justify-center' : ''}`}
        >
          <UserCircle size={20} className="text-slate-400 shrink-0" />
          {(!collapsed || isMobile) && (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          )}
        </NavLink>
        <button
          onClick={handleLogout}
          title={collapsed ? 'Logout' : undefined}
          className={`btn-ghost w-full mt-1 text-red-600 hover:bg-red-50 ${collapsed && !isMobile ? '!px-2 justify-center' : 'justify-start'}`}
        >
          <LogOut size={16} />
          {(!collapsed || isMobile) && <span>Logout</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      <motion.aside
        animate={{ width: collapsed ? 72 : 248 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="hidden md:flex flex-col border-r border-slate-100 bg-white relative"
      >
        <SidebarInner />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="absolute -right-3 top-16 h-6 w-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-500 hover:text-slate-800 hover:border-slate-300 transition"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
        </button>
      </motion.aside>

      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col md:hidden"
            >
              <SidebarInner isMobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white sticky top-0 z-30">
          <button onClick={() => setMobileOpen(true)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <Menu size={20} />
          </button>
          <Logo size={28} />
          <button onClick={handleLogout} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"><LogOut size={18} /></button>
        </header>
        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 p-3 md:p-6 max-w-[1600px] w-full mx-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
};

export default Layout;