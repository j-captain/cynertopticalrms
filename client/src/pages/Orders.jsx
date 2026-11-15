import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Send, RotateCcw, XCircle, Search, Calendar, Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import ExportMenu from '../components/ExportMenu.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtDate } from '../lib/date.js';
import { exportSummaryPdf, exportTablePdf } from '../lib/pdf.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const STATUS_STYLES = {
  pending:     { label: 'Pending',     cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  submitted:   { label: 'Submitted',   cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  resubmitted: { label: 'Resubmitted', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  delivered:   { label: 'Delivered',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  handed:      { label: 'Handed',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {s.label}
    </span>
  );
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

const Orders = () => {
  const { user } = useAuth();
  const [data, setData] = useState({ rows: [], summary: null, breakdowns: null });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [resendFor, setResendFor] = useState(null);
  const [resendEmail, setResendEmail] = useState('');
  const [resending, setResending] = useState(false);

  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/reports/orders', { params: { q, status, from, to } });
      setData(r.data);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, from, to]);

  const resend = async () => {
    setResending(true);
    try {
      // Server now guarantees a valid recipient (falls back through
      // log.recipientEmail → last known). We always use the resend endpoint
      // because submitOrder-on-already-placed now also bumps resendCount, but
      // resendOrder handles the failed-first-attempt case better.
      const logsRes = await api.get('/reports/order-logs');
      const logs = logsRes.data
        .filter((l) => String(l.patient) === String(resendFor._id))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      if (!logs.length) {
        // Should be impossible for a placed order, but keep the fallback.
        await api.post(`/patients/${resendFor._id}/order`, {
          sendToDefault: false,
          recipientEmail: resendEmail,
          emailMode: resendFor.emailMode || 'full',
        });
      } else {
        await api.post(`/orders/${logs[0]._id}/resend`, {
          recipientEmail: resendEmail || undefined,
          emailMode: resendFor.emailMode || 'full',
        });
      }
      setResendFor(null);
      setResendEmail('');
      setSuccessMsg(`Order email resent to ${resendEmail || 'previous recipient'}.`);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Resend failed');
    } finally {
      setResending(false);
    }
  };

  const openCancel = (o) => {
    setCancelTarget(o);
    setCancelOpen(true);
  };

  const confirmCancel = async () => {
    setCancelSaving(true);
    try {
      await api.post(`/orders/patient/${cancelTarget._id}/cancel`);
      setCancelOpen(false);
      setSuccessMsg(`Order for ${cancelTarget.patientName} cancelled successfully.`);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed');
    } finally {
      setCancelSaving(false);
    }
  };

  const csvHeader = [
    'Index', 'Patient', 'System No.', 'Scheme', 'Insurance', 'Lens Type',
    'RX BE', 'ADD', 'PD', 'Diagnoses', 'Complaint',
    'Lens Amount', 'Frame Code', 'Frame Amount', 'Total',
    'Pre-Auth', 'Submission Date', 'Status', 'Email Mode',
    'Emails Sent', 'Emails Failed', 'Last Email To',
  ];

  const buildCsvRows = () =>
    data.rows.map((r) => [
      r.index, r.patientName, r.systemNumber, r.scheme || '', r.insurance || '', r.lensType,
      r.rxBe || '', r.rxAdd || '', r.rxPd || '',
      r.diagnoses?.map((d) => `${d.code} ${d.description}`.trim()).join('; ') || '',
      r.complaint || '',
      r.lensAmount, r.frameCode || '', r.frameAmount, r.totalAmount,
      fmtDate(r.preAuthDate), fmtDate(r.submissionDate), r.status, r.emailMode || 'full',
      r.emailSentCount, r.emailFailedCount, r.lastEmailTo || '',
    ]);

  const exportCsv = () => {
    const csv = [csvHeader, ...buildCsvRows()]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Cynert Optical RMS - Orders-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const subtitleParts = [];
  if (status !== 'all') subtitleParts.push(status);
  if (from) subtitleParts.push(`from ${fmtDate(from)}`);
  if (to) subtitleParts.push(`to ${fmtDate(to)}`);
  if (q) subtitleParts.push(`search "${q}"`);

  const exportPdfSummary = () => {
    const s = data.summary || {};
    const b = data.breakdowns || {};

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
      title: 'Orders Summary',
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
      '#', 'Patient', 'Sys No.', 'Scheme', 'Insurance', 'Lens', 'RX BE', 'ADD', 'PD',
      'Diagnoses', 'Complaint', 'Total', 'Submitted', 'Emails', 'Status',
    ];
    const rows = data.rows.map((r) => [
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
      money(r.totalAmount),
      fmtDate(r.submissionDate),
      `${r.emailSentCount || 0} sent${r.emailFailedCount ? ` (${r.emailFailedCount} fail)` : ''}`,
      r.status,
    ]);
    exportTablePdf({
      title: 'Orders Table',
      subtitle: subtitleParts.join(' · ') || 'All orders',
      columns,
      rows,
    });
  };

  const cards = useMemo(() => data.summary ? [
    { label: 'Total', value: data.summary.count, cls: 'text-slate-900' },
    { label: 'Submitted', value: data.summary.submitted, cls: 'text-sky-600' },
    { label: 'Resubmitted', value: data.summary.resubmitted, cls: 'text-indigo-600' },
    { label: 'Delivered', value: data.summary.delivered, cls: 'text-amber-600' },
    { label: 'Handed', value: data.summary.handed, cls: 'text-emerald-600' },
    { label: 'Order Value', value: money(data.summary.total), cls: 'text-sky-600' },
  ] : [], [data.summary]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5">All orders with status markers & actions.</p>
        </div>
        <ExportMenu
          onCsv={exportCsv}
          onPdfSummary={exportPdfSummary}
          onPdfTable={exportPdfTable}
        />
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="card p-2.5"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className={`text-base font-extrabold mt-0.5 ${c.cls}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="relative md:col-span-4">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-2 !pl-8 !text-xs w-full"
            placeholder="Search patient, system no., frame code, scheme, insurance, lens or diagnosis…"
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
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="px-2 py-2 text-left font-semibold">Submitted</th>
                <th className="px-2 py-2 text-left font-semibold">Emails</th>
                <th className="px-2 py-2 text-left font-semibold">Status</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={16} className="text-center py-8 text-slate-400 text-xs">Loading…</td></tr>}
              {!loading && data.rows.length === 0 && <tr><td colSpan={16} className="text-center py-8 text-slate-400 text-xs">No orders yet.</td></tr>}
              {data.rows.map((o) => (
                <motion.tr key={o._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-t border-slate-100 hover:bg-sky-50/40">
                  <td className="px-2 py-1.5 text-slate-400 tabular-nums">{o.index}</td>
                  <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[140px] truncate">{o.patientName}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{o.systemNumber}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={`badge ${o.scheme === 'Insurance' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {o.scheme === 'Insurance' ? 'Insurance' : 'Cash'}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[140px] truncate" title={o.insurance || ''}>
                    {o.scheme === 'Insurance' ? (o.insurance || '-') : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{o.lensType}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{o.rxBe || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{o.rxAdd || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{o.rxPd || '-'}</td>
                  <td className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate" title={o.diagnoses?.map((d) => `${d.code} ${d.description}`).join(', ') || ''}>
                    {formatDiagnoses(o.diagnoses)}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 max-w-[160px] truncate" title={o.complaint || ''}>
                    {o.complaint || '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-sky-600 whitespace-nowrap tabular-nums">{money(o.totalAmount)}</td>
                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(o.submissionDate)}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">
                    {o.emailSentCount > 0 ? `${o.emailSentCount} sent` : '-'}
                    {o.emailFailedCount > 0 && <span className="text-rose-500 ml-1">({o.emailFailedCount} failed)</span>}
                  </td>
                  <td className="px-2 py-1.5"><StatusBadge status={o.status} /></td>
                  <td className="px-2 py-1.5">
                    <div className="flex justify-end gap-1">
                      {o.orderPlaced && (
                        <button
                          onClick={() => { setResendFor(o); setResendEmail(o.lastEmailTo || ''); }}
                          className="rounded-md p-1 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                          title="Resend email"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                      {user?.role === 'admin' && o.orderPlaced && !o.orderDelivered && (
                        <button
                          onClick={() => openCancel(o)}
                          className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Cancel order"
                        >
                          <XCircle size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Breakdown cards removed - the same data still appears in the
          PDF summary via exportPdfSummary → extraTables. */}

      <Modal open={!!resendFor} onClose={() => setResendFor(null)} title="Resend Order Email">
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Order: <span className="font-semibold">{resendFor?.patientName}</span> ({resendFor?.systemNumber})
          </p>
          <div>
            <label className="label">Recipient Email</label>
            <input className="input" type="email" value={resendEmail} onChange={(e) => setResendEmail(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-ghost" onClick={() => setResendFor(null)} disabled={resending}>Cancel</button>
            <button className="btn-primary" onClick={resend} disabled={resending}>
              {resending ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><Send size={14} /> Resend</>}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Order" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
            <XCircle className="text-rose-500" size={24} />
          </div>
          <p className="text-sm text-slate-600 text-center">
            Cancel the order for <span className="font-semibold text-slate-800">{cancelTarget?.patientName}</span> ({cancelTarget?.systemNumber})?
            This will unmark the order as submitted. No emails will be affected.
          </p>
          <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-semibold text-sky-600">{money(cancelTarget?.totalAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Submitted</span><span className="font-semibold text-slate-800">{fmtDate(cancelTarget?.submissionDate)}</span></div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setCancelOpen(false)} disabled={cancelSaving}>Keep Order</button>
            <button className="btn-danger" onClick={confirmCancel} disabled={cancelSaving}>
              {cancelSaving ? <span className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-600 animate-spin" /> : <><XCircle size={14} /> Cancel Order</>}
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

export default Orders;