import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar } from 'lucide-react';
import api from '../lib/api.js';
import ExportMenu from '../components/ExportMenu.jsx';
import { exportSummaryPdf, exportTablePdf } from '../lib/pdf.js';

const fmt = (d) => new Date(d).toLocaleString();

const tone = (action) => {
  if (action?.startsWith('patient.delete') || action?.includes('cancel')) return 'bg-rose-50 text-rose-700';
  if (action?.startsWith('patient.create')) return 'bg-emerald-50 text-emerald-700';
  if (action?.startsWith('order')) return 'bg-sky-50 text-sky-700';
  if (action?.startsWith('user') || action?.startsWith('settings')) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-600';
};

const Audit = () => {
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      Promise.all([
        api.get('/audit', { params: { q, from, to } }),
        api.get('/audit/summary', { params: { q, from, to } }),
      ])
        .then(([r, s]) => { setLogs(r.data); setSummary(s.data); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, from, to]);

  const subtitleParts = [];
  if (from) subtitleParts.push(`from ${from}`);
  if (to) subtitleParts.push(`to ${to}`);
  if (q) subtitleParts.push(`search "${q}"`);

  const exportCsv = () => {
    const header = ['When', 'Actor', 'Email', 'Action', 'Resource', 'Status', 'IP'];
    const rows = logs.map((l) => [
      fmt(l.createdAt), l.actorName || 'system', l.actorEmail || '',
      l.action, l.resource || '', l.status, l.ip || '',
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdfSummary = () => {
    const s = summary || {};
    exportSummaryPdf({
      title: 'Audit Log Summary',
      subtitle: subtitleParts.join(' · ') || 'All actions',
      stats: [
        { label: 'Total Events', value: s.count ?? 0 },
        { label: 'Successful', value: s.success ?? 0 },
        { label: 'Failed', value: s.failed ?? 0 },
        { label: 'Sent', value: s.sent ?? 0 },
        { label: 'Distinct Actors', value: s.actors ?? 0 },
      ],
      grouped: [
        { label: 'Date range', value: `${from || 'Any'} → ${to || 'Any'}` },
        { label: 'Search term', value: q || '-' },
      ],
      extraTables: [
        {
          title: 'Top Actions',
          headers: ['Action', 'Count'],
          rows: (s.breakdown || []).map((b) => [b.key, String(b.count)]),
        },
      ],
    });
  };

  const exportPdfTable = () => {
    const columns = ['When', 'Actor', 'Email', 'Action', 'Resource', 'Status', 'IP'];
    const pdfRows = logs.map((l) => [
      fmt(l.createdAt),
      l.actorName || 'system',
      l.actorEmail || '-',
      l.action,
      l.resource || '-',
      l.status,
      l.ip || '-',
    ]);
    exportTablePdf({
      title: 'Audit Log Table',
      subtitle: subtitleParts.join(' · ') || 'All actions',
      columns,
      rows: pdfRows,
    });
  };

  const summaryCards = useMemo(() => summary ? [
    { label: 'Total', value: summary.count, cls: 'text-slate-900' },
    { label: 'Success', value: summary.success, cls: 'text-emerald-600' },
    { label: 'Failed', value: summary.failed, cls: 'text-rose-600' },
    { label: 'Sent', value: summary.sent, cls: 'text-sky-600' },
    { label: 'Actors', value: summary.actors, cls: 'text-indigo-600' },
  ] : [], [summary]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-1">Every meaningful action in the system.</p>
        </div>
        <ExportMenu
          onCsv={exportCsv}
          onPdfSummary={exportPdfSummary}
          onPdfTable={exportPdfTable}
        />
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
      )}

      <div className="grid md:grid-cols-3 gap-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Search actor, email or action…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="relative">
          <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="date" className="input pl-8" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="relative">
          <Calendar size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="date" className="input pl-8" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                <th className="px-3 py-3 text-left font-semibold">When</th>
                <th className="px-3 py-3 text-left font-semibold">Actor</th>
                <th className="px-3 py-3 text-left font-semibold">Action</th>
                <th className="px-3 py-3 text-left font-semibold">Resource</th>
                <th className="px-3 py-3 text-left font-semibold">Status</th>
                <th className="px-3 py-3 text-left font-semibold">IP</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-10 text-slate-400">Loading…</td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-slate-400">No audit entries.</td></tr>}
              {logs.map((l, i) => (
                <motion.tr key={l._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.15) }} className="border-t border-slate-100 hover:bg-slate-50/70">
                  <td className="px-3 py-3 whitespace-nowrap text-slate-600">{fmt(l.createdAt)}</td>
                  <td className="px-3 py-3">
                    <div className="font-semibold text-slate-800">{l.actorName || 'system'}</div>
                    <div className="text-xs text-slate-500">{l.actorEmail || ''}</div>
                  </td>
                  <td className="px-3 py-3"><span className={`badge ${tone(l.action)}`}>{l.action}</span></td>
                  <td className="px-3 py-3 text-slate-600">{l.resource || '-'}</td>
                  <td className="px-3 py-3">
                    <span className={`badge ${l.status === 'sent' || l.status === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{l.status}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-500">{l.ip || '-'}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Audit;