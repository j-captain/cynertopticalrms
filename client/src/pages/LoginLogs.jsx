import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Filter, Calendar, LogIn, LogOut, ShieldAlert, Ban,
  Undo2, Power, Clock, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import ExportMenu from '../components/ExportMenu.jsx';
import { exportSummaryPdf, exportTablePdf } from '../lib/pdf.js';
import { useAuth } from '../context/AuthContext.jsx';

const fmt = (d) => (d ? new Date(d).toLocaleString() : '-');

const fmtDuration = (ms) => {
  if (!ms || ms < 0) return '-';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
};

const EVENT_STYLES = {
  login_success: { label: 'Login', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: LogIn },
  login_failed: { label: 'Failed', cls: 'bg-rose-50 text-rose-700 border-rose-200', icon: AlertTriangle },
  logout: { label: 'Logout', cls: 'bg-slate-50 text-slate-700 border-slate-200', icon: LogOut },
  blocked: { label: 'Blocked', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: ShieldAlert },
  banned: { label: 'Banned', cls: 'bg-rose-100 text-rose-800 border-rose-300', icon: Ban },
  unbanned: { label: 'Unbanned', cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: CheckCircle2 },
  force_logout: { label: 'Force Logout', cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: Power },
};

const EventBadge = ({ event }) => {
  const s = EVENT_STYLES[event] || { label: event, cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: LogIn };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      <Icon size={10} />
      {s.label}
    </span>
  );
};

const LoginLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [event, setEvent] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Ban modal
  const [banTarget, setBanTarget] = useState(null);
  const [banMinutes, setBanMinutes] = useState(60);
  const [banReason, setBanReason] = useState('');
  const [banWorking, setBanWorking] = useState(false);

  // Force logout modal
  const [logoutTarget, setLogoutTarget] = useState(null);
  const [logoutWorking, setLogoutWorking] = useState(false);

  // Unban modal
  const [unbanTarget, setUnbanTarget] = useState(null);
  const [unbanWorking, setUnbanWorking] = useState(false);

  // Success
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isAdmin = user?.role === 'admin';

  const load = async () => {
    setLoading(true);
    try {
      const [logsRes, sumRes] = await Promise.all([
        api.get('/login-logs', { params: { q, event, from, to } }),
        api.get('/login-logs/summary', { params: { from, to } }),
      ]);
      setLogs(logsRes.data);
      setSummary(sumRes.data);
    } catch (err) {
      toast.error('Failed to load login logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, event, from, to]);

  /* ── Ban ── */
  const openBan = (target) => {
    setBanTarget(target);
    setBanMinutes(60);
    setBanReason('');
  };
  const runBan = async () => {
    setBanWorking(true);
    try {
      await api.post(`/login-logs/user/${banTarget._id}/ban`, {
        minutes: banMinutes,
        reason: banReason || 'admin_action',
      });
      setBanTarget(null);
      setSuccessMsg(`${banTarget.name || banTarget.email} banned for ${banMinutes} minute(s).`);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Ban failed');
    } finally {
      setBanWorking(false);
    }
  };

  /* ── Force logout ── */
  const openLogout = (target) => setLogoutTarget(target);
  const runLogout = async () => {
    setLogoutWorking(true);
    try {
      await api.post(`/login-logs/user/${logoutTarget._id}/force-logout`);
      setLogoutTarget(null);
      setSuccessMsg(`${logoutTarget.name || logoutTarget.email} has been logged out.`);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Force logout failed');
    } finally {
      setLogoutWorking(false);
    }
  };

  /* ── Unban ── */
  const openUnban = (target) => setUnbanTarget(target);
  const runUnban = async () => {
    setUnbanWorking(true);
    try {
      await api.post(`/login-logs/user/${unbanTarget._id}/unban`);
      setUnbanTarget(null);
      setSuccessMsg(`${unbanTarget.name || unbanTarget.email} has been unbanned.`);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Unban failed');
    } finally {
      setUnbanWorking(false);
    }
  };

  /* ── Exports ── */
  const subtitleParts = [];
  if (event !== 'all') subtitleParts.push(event);
  if (from) subtitleParts.push(`from ${from}`);
  if (to) subtitleParts.push(`to ${to}`);
  if (q) subtitleParts.push(`search "${q}"`);

  const exportCsv = () => {
    const header = [
      'When', 'Event', 'User', 'Email', 'Reason', 'IP', 'Duration (s)', 'User Agent',
    ];
    const rows = logs.map((l) => [
      fmt(l.createdAt),
      l.event,
      l.userName || '',
      l.email || '',
      l.reason || '',
      l.ip || '',
      l.durationMs ? Math.round(l.durationMs / 1000) : '',
      l.userAgent || '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `login-logs-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdfSummary = () => {
    const s = summary || {};
    exportSummaryPdf({
      title: 'Login Logs Summary',
      subtitle: subtitleParts.join(' · ') || 'All events',
      stats: [
        { label: 'Total Events', value: s.count ?? 0 },
        { label: 'Successful Logins', value: s.success ?? 0 },
        { label: 'Failed Logins', value: s.failed ?? 0 },
        { label: 'Blocked Attempts', value: s.blocked ?? 0 },
        { label: 'Bans', value: s.banned ?? 0 },
        { label: 'Logouts', value: s.loggedOut ?? 0 },
        { label: 'Total Session Time', value: fmtDuration(s.totalSessionMs) },
        { label: 'Avg Session', value: fmtDuration(s.avgSessionMs) },
      ],
      grouped: [
        { label: 'Event filter', value: event === 'all' ? 'All events' : event },
        { label: 'Date range', value: `${from || 'Any'} → ${to || 'Any'}` },
        { label: 'Search term', value: q || '-' },
      ],
    });
  };

  const exportPdfTable = () => {
    const columns = ['When', 'Event', 'User', 'Email', 'Reason', 'IP', 'Duration'];
    const pdfRows = logs.map((l) => [
      fmt(l.createdAt),
      EVENT_STYLES[l.event]?.label || l.event,
      l.userName || '-',
      l.email || '-',
      l.reason || '-',
      l.ip || '-',
      fmtDuration(l.durationMs),
    ]);
    exportTablePdf({
      title: 'Login Logs Table',
      subtitle: subtitleParts.join(' · ') || 'All events',
      columns,
      rows: pdfRows,
    });
  };

  /* ── Cards ── */
  const summaryCards = useMemo(() => summary ? [
    { label: 'Total Events', value: summary.count, cls: 'text-slate-900' },
    { label: 'Successful', value: summary.success, cls: 'text-emerald-600' },
    { label: 'Failed', value: summary.failed, cls: 'text-rose-600' },
    { label: 'Blocked', value: summary.blocked, cls: 'text-amber-600' },
    { label: 'Bans', value: summary.banned, cls: 'text-rose-700' },
    { label: 'Logouts', value: summary.loggedOut, cls: 'text-slate-700' },
    { label: 'Total Session Time', value: fmtDuration(summary.totalSessionMs), cls: 'text-sky-600' },
    { label: 'Avg Session', value: fmtDuration(summary.avgSessionMs), cls: 'text-indigo-600' },
  ] : [], [summary]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Login Logs</h1>
          <p className="text-xs text-slate-500 mt-0.5">Every authentication event, session, and account action.</p>
        </div>
        <ExportMenu
          onCsv={exportCsv}
          onPdfSummary={exportPdfSummary}
          onPdfTable={exportPdfTable}
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {summaryCards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="card p-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className={`text-lg font-extrabold mt-0.5 ${c.cls}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="relative md:col-span-5">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-2 !pl-8 !text-xs w-full"
            placeholder="Search email, name, IP, or reason…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="relative md:col-span-3">
          <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            className="input !py-2 !pl-8 !pr-7 !text-xs appearance-none w-full"
            value={event}
            onChange={(e) => setEvent(e.target.value)}
          >
            <option value="all">All events</option>
            <option value="login_success">Successful logins</option>
            <option value="login_failed">Failed logins</option>
            <option value="logout">Logouts</option>
            <option value="blocked">Blocked attempts</option>
            <option value="banned">Bans</option>
            <option value="unbanned">Unbans</option>
            <option value="force_logout">Force logouts</option>
          </select>
        </div>
        <div className="relative md:col-span-2">
          <Calendar size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="date" className="input !py-2 !pl-7 !text-xs w-full" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="relative md:col-span-2">
          <Calendar size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="date" className="input !py-2 !pl-7 !text-xs w-full" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-2 text-left font-semibold">When</th>
                <th className="px-2 py-2 text-left font-semibold">Event</th>
                <th className="px-2 py-2 text-left font-semibold">User</th>
                <th className="px-2 py-2 text-left font-semibold">Email</th>
                <th className="px-2 py-2 text-left font-semibold">Reason</th>
                <th className="px-2 py-2 text-left font-semibold">IP</th>
                <th className="px-2 py-2 text-right font-semibold">Duration</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-xs">Loading…</td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-slate-400 text-xs">No events found.</td></tr>
              )}
              {logs.map((l) => {
                const target = l.user
                  ? { _id: l.user, name: l.userName, email: l.email }
                  : null;
                return (
                  <motion.tr
                    key={l._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-t border-slate-100 hover:bg-sky-50/40"
                  >
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmt(l.createdAt)}</td>
                    <td className="px-2 py-1.5"><EventBadge event={l.event} /></td>
                    <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[140px] truncate">
                      {l.userName || '-'}
                    </td>
                    <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[220px] truncate" title={l.email || ''}>
                      {l.email || '-'}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap max-w-[160px] truncate" title={l.reason || ''}>
                      {l.reason || '-'}
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap font-mono text-[10px]">{l.ip || '-'}</td>
                    <td className="px-2 py-1.5 text-right text-slate-600 whitespace-nowrap tabular-nums">
                      {l.event === 'logout' ? fmtDuration(l.durationMs) : '-'}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {isAdmin && target ? (
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => openLogout(target)}
                            className="rounded-md p-1 text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                            title="Force logout"
                          >
                            <Power size={12} />
                          </button>
                          <button
                            onClick={() => openBan(target)}
                            className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Ban user"
                          >
                            <Ban size={12} />
                          </button>
                          <button
                            onClick={() => openUnban(target)}
                            className="rounded-md p-1 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                            title="Unban user"
                          >
                            <Undo2 size={12} />
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ban modal */}
      <Modal
        open={!!banTarget}
        onClose={() => !banWorking && setBanTarget(null)}
        title="Ban User"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center ring-4 ring-rose-100">
            <Ban className="text-rose-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Ban <span className="font-semibold">{banTarget?.name || banTarget?.email}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              They will be immediately logged out of any active session and unable to sign in until the ban expires.
            </p>
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input
              type="number"
              min="1"
              max="10080"
              className="input"
              value={banMinutes}
              onChange={(e) => setBanMinutes(Math.max(1, Number(e.target.value) || 1))}
            />
            <p className="text-[11px] text-slate-400 mt-1">Max 10,080 minutes (7 days).</p>
          </div>
          <div>
            <label className="label">Reason (optional)</label>
            <input
              className="input"
              placeholder="e.g. Suspicious activity"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setBanTarget(null)} disabled={banWorking}>Cancel</button>
            <button className="btn-danger" onClick={runBan} disabled={banWorking}>
              {banWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-600 animate-spin" />
              ) : (
                <><Ban size={14} /> Ban User</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Force logout modal */}
      <Modal
        open={!!logoutTarget}
        onClose={() => !logoutWorking && setLogoutTarget(null)}
        title="Force Logout"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-violet-50 grid place-items-center ring-4 ring-violet-100">
            <Power className="text-violet-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Force logout <span className="font-semibold">{logoutTarget?.name || logoutTarget?.email}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Their current session will be terminated immediately. They can sign in again.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setLogoutTarget(null)} disabled={logoutWorking}>Cancel</button>
            <button className="btn-primary" onClick={runLogout} disabled={logoutWorking}>
              {logoutWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Power size={14} /> Logout Now</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unban modal */}
      <Modal
        open={!!unbanTarget}
        onClose={() => !unbanWorking && setUnbanTarget(null)}
        title="Unban User"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 grid place-items-center ring-4 ring-emerald-100">
            <Undo2 className="text-emerald-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Unban <span className="font-semibold">{unbanTarget?.name || unbanTarget?.email}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Their ban will be lifted immediately and failed-attempt counter reset.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => setUnbanTarget(null)} disabled={unbanWorking}>Cancel</button>
            <button className="btn-primary" onClick={runUnban} disabled={unbanWorking}>
              {unbanWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Undo2 size={14} /> Unban</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Success"
        message={successMsg}
      />
    </div>
  );
};

export default LoginLogs;