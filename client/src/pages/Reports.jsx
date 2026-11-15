import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Search, Filter } from 'lucide-react';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import ExportMenu from '../components/ExportMenu.jsx';
import { exportSummaryPdf, exportTablePdf } from '../lib/pdf.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 0 })}`;

const STATUS_STYLES = {
  pending:     { label: 'Pending',     cls: 'bg-slate-100 text-slate-600' },
  submitted:   { label: 'Submitted',   cls: 'bg-sky-100 text-sky-700' },
  resubmitted: { label: 'Resubmitted', cls: 'bg-indigo-100 text-indigo-700' },
  delivered:   { label: 'Delivered',   cls: 'bg-amber-100 text-amber-700' },
  handed:      { label: 'Handed',      cls: 'bg-emerald-100 text-emerald-700' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

const formatDiagnoses = (diagnoses) => {
  if (!diagnoses || !diagnoses.length) return '-';
  return diagnoses
    .map((d, i) => {
      const parts = [d.code, d.description].filter(Boolean);
      return `${i + 1}. ${parts.join(' - ')}`;
    })
    .join(', ');
};

const Reports = () => {
  const [data, setData] = useState({ rows: [], summary: null, breakdowns: null });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api.get('/reports/orders', { params: { q, status, from, to } })
        .then((r) => setData(r.data))
        .catch((err) => console.error('Reports fetch failed:', err))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, from, to]);

  const { rows, summary, breakdowns } = data;

  const csvHeader = [
    'Index', 'Patient', 'System No.', 'Scheme', 'Insurance', 'Lens Type',
    'RX BE', 'ADD', 'PD', 'Diagnoses', 'Complaint',
    'Lens Amount', 'Frame Code', 'Frame Amount', 'Total',
    'Pre-Auth', 'Submission Date', 'Status', 'Email Mode',
    'Emails Sent', 'Emails Failed',
    'Last Email To', 'Last Email At',
  ];

  const buildCsvRows = () =>
    rows.map((r) => [
      r.index, r.patientName, r.systemNumber, r.scheme || '', r.insurance || '', r.lensType,
      r.rxBe || '', r.rxAdd || '', r.rxPd || '',
      r.diagnoses?.map((d) => `${d.code} ${d.description}`.trim()).join('; ') || '',
      r.complaint || '',
      r.lensAmount, r.frameCode || '', r.frameAmount, r.totalAmount,
      fmtDate(r.preAuthDate), fmtDate(r.submissionDate), r.status, r.emailMode || 'full',
      r.emailSentCount, r.emailFailedCount,
      r.lastEmailTo || '', r.lastEmailAt ? new Date(r.lastEmailAt).toLocaleString() : '',
    ]);

  const exportCsv = () => {
    const csv = [csvHeader, ...buildCsvRows()]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cynert Optical RMS - Reports-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const subtitleParts = [];
  if (status !== 'all') subtitleParts.push(status);
  if (from) subtitleParts.push(`from ${fmtDate(from)}`);
  if (to) subtitleParts.push(`to ${fmtDate(to)}`);
  if (q) subtitleParts.push(`search "${q}"`);

  const exportPdfSummary = () => {
    const s = summary || {};
    const b = breakdowns || {};

    const breakdownToRows = (rows) =>
      (rows || []).map((g) => [
        g.key,
        String(g.count),
        String(g.submitted),
        String(g.resubmitted),
        String(g.delivered),
        String(g.handed),
        money(g.total),
      ]);

    exportSummaryPdf({
      title: 'Reports Summary',
      subtitle: subtitleParts.join(' · ') || 'All orders',
      stats: [
        { label: 'Total Orders', value: s.count ?? 0 },
        { label: 'Submitted', value: s.submitted ?? 0 },
        { label: 'Resubmitted', value: s.resubmitted ?? 0 },
        { label: 'Delivered', value: s.delivered ?? 0 },
        { label: 'Handed', value: s.handed ?? 0 },
        { label: 'Order Value', value: money(s.total) },
        { label: 'Lens Total', value: money(s.lens) },
        { label: 'Frame Total', value: money(s.frame) },
      ],
      grouped: [
        { label: 'Emails Sent', value: String(s.emailsSent ?? 0) },
        { label: 'Emails Failed', value: String(s.emailsFailed ?? 0) },
        { label: 'Status filter', value: status === 'all' ? 'All statuses' : status },
        { label: 'Date range', value: `${from || 'Any'} → ${to || 'Any'}` },
        { label: 'Search term', value: q || '-' },
      ],
      extraTables: [
        {
          title: 'By Lens Type',
          headers: ['Lens Type', 'Count', 'Submitted', 'Resubmitted', 'Delivered', 'Handed', 'Value'],
          rows: breakdownToRows(b.byLensType),
        },
        {
          title: 'By Scheme',
          headers: ['Scheme', 'Count', 'Submitted', 'Resubmitted', 'Delivered', 'Handed', 'Value'],
          rows: breakdownToRows(b.byScheme),
        },
        {
          title: 'By Insurance',
          headers: ['Insurance', 'Count', 'Submitted', 'Resubmitted', 'Delivered', 'Handed', 'Value'],
          rows: breakdownToRows(b.byInsurance),
        },
      ],
    });
  };

  const exportPdfTable = () => {
    const columns = [
      '#', 'Patient', 'Sys No.', 'Scheme', 'Insurance', 'Lens',
      'RX BE', 'ADD', 'PD', 'Diagnoses', 'Complaint', 'Lens Amt', 'Frame', 'Frame Amt', 'Total',
      'Pre-Auth', 'Submitted', 'Status', 'Mode', 'Emails',
    ];
    const pdfRows = rows.map((r) => [
      r.index,
      r.patientName,
      r.systemNumber,
      r.scheme === 'Insurance' ? 'Insurance' : 'Cash',
      r.scheme === 'Insurance' ? (r.insurance || '-') : '-',
      r.lensType,
      r.rxBe || '-',
      r.rxAdd || '-',
      r.rxPd || '-',
      r.diagnoses?.map((d) => `${d.code} ${d.description}`.trim()).join('; ') || '-',
      r.complaint || '-',
      money(r.lensAmount),
      r.frameCode || '-',
      money(r.frameAmount),
      money(r.totalAmount),
      fmtDate(r.preAuthDate),
      fmtDate(r.submissionDate),
      r.status,
      r.emailMode || 'full',
      `${r.emailSentCount || 0} sent${r.emailFailedCount ? ` (${r.emailFailedCount} fail)` : ''}`,
    ]);
    exportTablePdf({
      title: 'Reports Table',
      subtitle: subtitleParts.join(' · ') || 'All orders',
      columns,
      rows: pdfRows,
    });
  };

  const summaryCards = useMemo(() => summary ? [
    { label: 'Total Orders', value: summary.count, cls: 'text-slate-900' },
    { label: 'Submitted', value: summary.submitted, cls: 'text-sky-600' },
    { label: 'Resubmitted', value: summary.resubmitted, cls: 'text-indigo-600' },
    { label: 'Delivered', value: summary.delivered, cls: 'text-amber-600' },
    { label: 'Handed', value: summary.handed, cls: 'text-emerald-600' },
    { label: 'Order Value', value: money(summary.total), cls: 'text-sky-600' },
    { label: 'Lens Total', value: money(summary.lens), cls: 'text-indigo-600' },
    { label: 'Frame Total', value: money(summary.frame), cls: 'text-emerald-600' },
  ] : [], [summary]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Every order across all statuses.</p>
        </div>
        <ExportMenu
          onCsv={exportCsv}
          onPdfSummary={exportPdfSummary}
          onPdfTable={exportPdfTable}
        />
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="relative md:col-span-4">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-2 !pl-8 !text-xs w-full"
            placeholder="Search patient, system no., frame code, scheme, insurance, lens, or diagnosis…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="relative md:col-span-3">
          <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <select
            className="input !py-2 !pl-8 !pr-7 !text-xs appearance-none w-full"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="submitted">Submitted</option>
            <option value="resubmitted">Resubmitted</option>
            <option value="delivered">Delivered</option>
            <option value="handed">Handed</option>
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
        <div className="md:col-span-1 flex justify-end">
          <button
            onClick={() => { setQ(''); setStatus('all'); setFrom(''); setTo(''); }}
            className="btn-ghost !py-2 !px-2 !text-xs w-full md:w-auto"
            title="Clear filters"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Patient</th>
                <th className="px-2 py-2 text-left font-semibold">Sys No.</th>
                <th className="px-2 py-2 text-left font-semibold">Scheme</th>
                <th className="px-2 py-2 text-left font-semibold">Insurance</th>
                <th className="px-2 py-2 text-left font-semibold">Lens</th>
                <th className="px-2 py-2 text-left font-semibold">RX BE</th>
                <th className="px-2 py-2 text-left font-semibold">ADD</th>
                <th className="px-2 py-2 text-left font-semibold">PD</th>
                <th className="px-2 py-2 text-left font-semibold">Diagnoses</th>
                <th className="px-2 py-2 text-left font-semibold">Complaint</th>
                <th className="px-2 py-2 text-right font-semibold">Lens ₹</th>
                <th className="px-2 py-2 text-left font-semibold">Frame</th>
                <th className="px-2 py-2 text-right font-semibold">Frm ₹</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="px-2 py-2 text-left font-semibold">Submitted</th>
                <th className="px-2 py-2 text-left font-semibold">Mode</th>
                <th className="px-2 py-2 text-left font-semibold">Emails</th>
                <th className="px-2 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={19} className="text-center py-8 text-slate-400 text-xs">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={19} className="text-center py-8 text-slate-400 text-xs">No orders found.</td></tr>
              )}
              {rows.map((r) => (
                <motion.tr
                  key={r._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t border-slate-100 hover:bg-sky-50/40"
                >
                  <td className="px-2 py-1.5 text-slate-400 tabular-nums">{r.index}</td>
                  <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[140px] truncate">{r.patientName}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.systemNumber}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={`badge ${r.scheme === 'Insurance' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {r.scheme === 'Insurance' ? 'Insurance' : 'Cash'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[140px] truncate" title={r.insurance || ''}>
                    {r.scheme === 'Insurance' ? (r.insurance || '-') : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{r.lensType}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.rxBe || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.rxAdd || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.rxPd || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate" title={r.diagnoses?.map((d) => `${d.code} ${d.description}`).join(', ') || ''}>
                    {formatDiagnoses(r.diagnoses)}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 max-w-[160px] truncate" title={r.complaint || ''}>
                    {r.complaint || '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-700 whitespace-nowrap tabular-nums">{money(r.lensAmount)}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{r.frameCode || '-'}</td>
                  <td className="px-2 py-1.5 text-right text-slate-700 whitespace-nowrap tabular-nums">{money(r.frameAmount)}</td>
                  <td className="px-2 py-1.5 text-right font-bold text-sky-600 whitespace-nowrap tabular-nums">{money(r.totalAmount)}</td>
                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(r.submissionDate)}</td>
                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                    <span className={`badge ${r.emailMode === 'mini' ? 'bg-indigo-50 text-indigo-700' : 'bg-sky-50 text-sky-700'}`}>
                      {r.emailMode === 'mini' ? 'Mini' : 'Full'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className="text-slate-600">
                      {r.emailSentCount > 0 ? `${r.emailSentCount} sent` : '-'}
                    </span>
                    {r.emailFailedCount > 0 && (
                      <span className="text-rose-500 ml-1">({r.emailFailedCount} failed)</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5"><StatusBadge status={r.status} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown cards removed - the same data still appears in the
          PDF summary via exportPdfSummary → extraTables. */}
    </div>
  );
};

export default Reports;