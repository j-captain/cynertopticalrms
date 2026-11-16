import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Filter, Calendar, Wallet, CheckCircle2, Package, Clock,
  ClipboardList, Pencil, Undo2, Truck, Layers, XCircle, Lock, Eye,
  RefreshCw, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import ExportMenu from '../components/ExportMenu.jsx';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import { exportSummaryPdf, exportTablePdf } from '../lib/pdf.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const STATUS_STYLES = {
  pending_billing:      { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Clock },
  billed:               { label: 'Billed',    cls: 'bg-sky-50 text-sky-700 border-sky-200',          icon: Wallet },
  submitted_to_director:{ label: 'Submitted', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: Layers },
  paid:                 { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  delivered:            { label: 'Delivered', cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: Package },
};

const BATCH_STATUS_STYLES = {
  submitted: { label: 'Submitted', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  paid:      { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending_billing;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      <Icon size={10} />
      {s.label}
    </span>
  );
};

const BatchStatusBadge = ({ status }) => {
  const s = BATCH_STATUS_STYLES[status] || BATCH_STATUS_STYLES.submitted;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      {s.label}
    </span>
  );
};

const Billing = () => {
  const [tab, setTab] = useState('orders'); // 'orders' | 'batches'

  /* Orders state */
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  /* Batches state */
  const [batches, setBatches] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchStatus, setBatchStatus] = useState('all');
  const [batchQuery, setBatchQuery] = useState('');
  const [batchDetails, setBatchDetails] = useState(null);

  /* Bill / Edit modal */
  const [editRow, setEditRow] = useState(null);
  const [editMode, setEditMode] = useState(null); // 'bill' | 'edit'
  const [form, setForm] = useState({ lenses: '', frame: '', fitting: '', caseAmount: '', fargo: '' });
  const [saving, setSaving] = useState(false);

  /* Confirm modals */
  const [actionRow, setActionRow] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [actionWorking, setActionWorking] = useState(false);

  /* Batch action confirm */
  const [batchAction, setBatchAction] = useState(null); // { batch, action }

  /* Success modal */
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  /* ─── Load orders ─── */
  const load = async () => {
    setLoading(true);
    try {
      const [rowsRes, sumRes] = await Promise.all([
        api.get('/billing/admin/overview', { params: { q, status } }),
        api.get('/billing/admin/summary'),
      ]);
      setRows(rowsRes.data);
      setSummary(sumRes.data);
    } catch {
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Load batches ─── */
  const loadBatches = async () => {
    setBatchLoading(true);
    try {
      const res = await api.get('/billing/admin/batches', { params: { status: batchStatus } });
      setBatches(res.data);
    } catch {
      toast.error('Failed to load batches');
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  useEffect(() => {
    if (tab === 'batches') loadBatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, batchStatus]);

  /* ─── Order date-range filter ─── */
  const filteredRows = useMemo(() => {
    if (!from && !to) return rows;
    return rows.filter((r) => {
      const d = r.billing?.billedAt || r.submissionDate || r.updatedAt;
      if (!d) return false;
      const t = new Date(d);
      if (from && t < new Date(from)) return false;
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (t > end) return false;
      }
      return true;
    });
  }, [rows, from, to]);

  const filteredBatches = useMemo(() => {
    const needle = batchQuery.trim().toLowerCase();
    if (!needle) return batches;
    return batches.filter((b) =>
      (b.batchNumber || '').toLowerCase().includes(needle) ||
      (b.submittedByName || '').toLowerCase().includes(needle) ||
      (b.orderIds || []).some((o) =>
        (o.name || '').toLowerCase().includes(needle) ||
        (o.systemNumber || '').toLowerCase().includes(needle)
      )
    );
  }, [batches, batchQuery]);

  /* ─── Bill / Edit handlers ─── */
  const openBill = (r) => {
    setEditRow(r);
    setEditMode('bill');
    setForm({ lenses: '', frame: '', fitting: '', caseAmount: '', fargo: '' });
  };

  const openEdit = (r) => {
    const b = r.billing || {};
    setEditRow(r);
    setEditMode('edit');
    setForm({
      lenses: String(b.lenses ?? ''),
      frame: String(b.frame ?? ''),
      fitting: String(b.fitting ?? ''),
      caseAmount: String(b.caseAmount ?? ''),
      fargo: String(b.fargo ?? ''),
    });
  };

  const closeEdit = () => {
    if (saving) return;
    setEditRow(null);
    setEditMode(null);
  };

  const formTotal = Object.values(form).reduce((s, v) => s + (Number(v) || 0), 0);

  const saveBill = async () => {
    setSaving(true);
    try {
      const url = editMode === 'bill'
        ? `/billing/admin/${editRow._id}/bill`
        : `/billing/admin/${editRow._id}/edit-bill`;
      await api.post(url, form);
      setSuccessMsg(
        editMode === 'bill'
          ? `Bill submitted for ${editRow.patientName} (${money(formTotal)}).`
          : `Bill updated for ${editRow.patientName} (${money(formTotal)}).`
      );
      setSuccessOpen(true);
      setEditRow(null);
      setEditMode(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  /* ─── Order simple actions ─── */
  const openAction = (r, type) => {
    setActionRow(r);
    setActionType(type);
  };
  const closeAction = () => {
    if (actionWorking) return;
    setActionRow(null);
    setActionType(null);
  };

  const runAction = async () => {
    setActionWorking(true);
    try {
      const url = `/billing/admin/${actionRow._id}/${actionType}`;
      await api.post(url);
      const messages = {
        paid: `Marked as paid for ${actionRow.patientName}.`,
        deliver: `Marked delivered for ${actionRow.patientName}.`,
        'revert-pending': `Reverted to pending for ${actionRow.patientName}. The bill was cleared.`,
        'revert-billed': `Reverted to billed for ${actionRow.patientName}.`,
      };
      setSuccessMsg(messages[actionType] || 'Updated.');
      setSuccessOpen(true);
      setActionRow(null);
      setActionType(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Action failed');
    } finally {
      setActionWorking(false);
    }
  };

  /* ─── Batch actions ─── */
  const runBatchAction = async () => {
    if (!batchAction) return;
    setActionWorking(true);
    try {
      const { batch, action } = batchAction;
      if (action === 'cancel') {
        await api.post(`/billing/batches/${batch._id}/cancel`);
        setSuccessMsg(`Batch ${batch.batchNumber} cancelled. Orders reverted to draft.`);
      } else {
        await api.post(`/billing/admin/batches/${batch._id}/action`, { action });
        setSuccessMsg(
          action === 'paid'
            ? `Batch ${batch.batchNumber} marked paid.`
            : `Batch ${batch.batchNumber} reverted to submitted.`
        );
      }
      setSuccessOpen(true);
      setBatchAction(null);
      loadBatches();
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Batch action failed');
    } finally {
      setActionWorking(false);
    }
  };

  /* ─── Exports ─── */
  const subtitleParts = [];
  if (status !== 'all') subtitleParts.push(status.replace(/_/g, ' '));
  if (from) subtitleParts.push(`from ${from}`);
  if (to) subtitleParts.push(`to ${to}`);
  if (q) subtitleParts.push(`search "${q}"`);

  const exportCsv = () => {
    const header = [
      'Index', 'Patient', 'System No.', 'Lens Type', 'Frame Code',
      'Billing Status', 'Lenses', 'Frame', 'Fitting', 'Case', 'Fargo', 'Total',
      'Billed By', 'Billed At', 'Paid At', 'Batch',
    ];
    const out = filteredRows.map((r) => [
      r.index, r.patientName, r.systemNumber, r.lensType, r.frameCode || '',
      r.billingStatus,
      r.billing?.lenses ?? '', r.billing?.frame ?? '', r.billing?.fitting ?? '',
      r.billing?.caseAmount ?? '', r.billing?.fargo ?? '', r.billing?.total ?? '',
      r.billing?.billedByName || '', r.billing?.billedAt ? fmtDate(r.billing.billedAt) : '',
      r.billing?.paidAt ? fmtDate(r.billing.paidAt) : '',
      r.billing?.batchId ? 'Batched' : 'Draft',
    ]);
    const csv = [header, ...out]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdfSummary = () => {
    const s = summary || {};
    exportSummaryPdf({
      title: 'Billing Summary',
      subtitle: subtitleParts.join(' · ') || 'All orders',
      stats: [
        { label: 'Pending',        value: s.pendingCount ?? 0 },
        { label: 'Billed (draft)', value: s.billedCount ?? 0 },
        { label: 'Submitted',      value: s.submittedCount ?? 0 },
        { label: 'Paid',           value: s.paidCount ?? 0 },
        { label: 'Delivered',      value: s.deliveredCount ?? 0 },
        { label: 'Billed Total',   value: money(s.billedTotal) },
        { label: 'Submitted Total',value: money(s.submittedTotal) },
        { label: 'Paid Total',     value: money(s.paidTotal) },
        { label: 'Fargo Total',    value: money(s.fargoTotal) },
        { label: 'Grand Total',    value: money(s.grandTotal) },
      ],
      grouped: [
        { label: 'Status filter', value: status === 'all' ? 'All statuses' : status },
        { label: 'Date range',    value: `${from || 'Any'} → ${to || 'Any'}` },
        { label: 'Search term',   value: q || '-' },
      ],
    });
  };

  const exportPdfTable = () => {
    const columns = ['#', 'Patient', 'Lens Type', 'Frame', 'Status',
      'Lenses', 'Frame Amt', 'Fitting', 'Case', 'Fargo', 'Total'];
    const pdfRows = filteredRows.map((r) => [
      r.index, r.patientName, r.lensType, r.frameCode || '-',
      STATUS_STYLES[r.billingStatus]?.label || r.billingStatus,
      r.billing?.lenses != null ? money(r.billing.lenses) : '-',
      r.billing?.frame != null ? money(r.billing.frame) : '-',
      r.billing?.fitting != null ? money(r.billing.fitting) : '-',
      r.billing?.caseAmount != null ? money(r.billing.caseAmount) : '-',
      r.billing?.fargo != null ? money(r.billing.fargo) : '-',
      r.billing?.total != null ? money(r.billing.total) : '-',
    ]);
    exportTablePdf({ title: 'Billing Table', subtitle: subtitleParts.join(' · ') || 'All orders', columns, rows: pdfRows });
  };

  /* ─── Summary cards - now aligned to adminBillingSummary response ─── */
  const cards = useMemo(() => summary ? [
    { label: 'Pending',          value: summary.pendingCount,    cls: 'text-amber-600' },
    { label: 'Billed (draft)',   value: summary.billedCount,     cls: 'text-sky-600' },
    { label: 'Submitted',        value: summary.submittedCount,  cls: 'text-indigo-600' },
    { label: 'Paid',             value: summary.paidCount,       cls: 'text-emerald-600' },
    { label: 'Delivered',        value: summary.deliveredCount,  cls: 'text-violet-600' },
    { label: 'Billed Total',     value: money(summary.billedTotal),    cls: 'text-sky-700' },
    { label: 'Submitted Total',  value: money(summary.submittedTotal), cls: 'text-indigo-700' },
    { label: 'Paid Total',       value: money(summary.paidTotal),      cls: 'text-emerald-700' },
    { label: 'Fargo Total',      value: money(summary.fargoTotal),     cls: 'text-rose-700' },
    { label: 'Grand Total',      value: money(summary.grandTotal),     cls: 'text-slate-900' },
  ] : [], [summary]);

  /* ─── Per-row action button ─── */
  const RowActions = ({ r }) => {
    const s = r.billingStatus;
    const batched = !!r.billing?.batchId;

    if (s === 'pending_billing') {
      return (
        <button onClick={() => openBill(r)}
          className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-2 py-1 text-[10px] font-semibold hover:shadow-md hover:-translate-y-0.5 transition">
          <ClipboardList size={10} /> Bill
        </button>
      );
    }

    if (s === 'billed') {
      return (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit bill">
            <Pencil size={12} />
          </button>
          <button onClick={() => openAction(r, 'revert-pending')}
            className="rounded-md p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Revert to pending">
            <Undo2 size={12} />
          </button>
          <button onClick={() => openAction(r, 'paid')}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 text-[10px] font-semibold hover:bg-emerald-100 transition">
            <CheckCircle2 size={10} /> Mark Paid
          </button>
        </div>
      );
    }

    if (s === 'submitted_to_director') {
      if (batched) {
        return (
          <div className="flex items-center justify-end gap-1">
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400" title="Locked - belongs to a submitted batch">
              <Lock size={10} /> Batched
            </span>
            <button onClick={() => setTab('batches')}
              className="rounded-md p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600" title="Open batches tab">
              <Layers size={12} />
            </button>
          </div>
        );
      }
      return (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit bill">
            <Pencil size={12} />
          </button>
          <button onClick={() => openAction(r, 'paid')}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 text-[10px] font-semibold hover:bg-emerald-100 transition">
            <CheckCircle2 size={10} /> Mark Paid
          </button>
        </div>
      );
    }

    if (s === 'paid') {
      return (
        <div className="flex items-center justify-end gap-1">
          {!batched && (
            <button onClick={() => openEdit(r)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit bill">
              <Pencil size={12} />
            </button>
          )}
          <button onClick={() => openAction(r, 'revert-billed')}
            className="rounded-md p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Revert to billed">
            <Undo2 size={12} />
          </button>
          <button onClick={() => openAction(r, 'deliver')}
            className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-600 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 transition">
            <Truck size={10} /> Deliver
          </button>
        </div>
      );
    }

    if (s === 'delivered') {
      return (
        <button onClick={() => !batched && openEdit(r)} disabled={batched}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40" title="Edit bill">
          <Pencil size={12} />
        </button>
      );
    }
    return null;
  };

  /* ─── Render ─── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Billing</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full billing control - bill, edit, submit batches, mark paid, deliver, revert.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
            <button onClick={() => setTab('orders')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${tab === 'orders' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              Orders
            </button>
            <button onClick={() => setTab('batches')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${tab === 'batches' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
              Batches
            </button>
          </div>
          <ExportMenu onCsv={exportCsv} onPdfSummary={exportPdfSummary} onPdfTable={exportPdfTable} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }} className="card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className={`text-lg font-extrabold mt-0.5 ${c.cls}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* ───────────── Orders Tab ───────────── */}
      {tab === 'orders' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="relative md:col-span-4">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input !py-2 !pl-8 !text-xs w-full" placeholder="Search patient, lens, frame, insurance…"
                value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="relative md:col-span-3">
              <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select className="input !py-2 !pl-8 !pr-7 !text-xs appearance-none w-full"
                value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="pending_billing">Pending</option>
                <option value="billed">Billed (draft)</option>
                <option value="submitted_to_director">Submitted</option>
                <option value="paid">Paid</option>
                <option value="delivered">Delivered</option>
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
              <button onClick={() => { setQ(''); setStatus('all'); setFrom(''); setTo(''); }}
                className="btn-ghost !py-2 !px-2 !text-xs w-full md:w-auto" title="Clear filters">
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
                    <th className="px-2 py-2 text-left font-semibold">Lens Type</th>
                    <th className="px-2 py-2 text-left font-semibold">Frame</th>
                    <th className="px-2 py-2 text-left font-semibold">Status</th>
                    <th className="px-2 py-2 text-right font-semibold">Lenses</th>
                    <th className="px-2 py-2 text-right font-semibold">Frame Amt</th>
                    <th className="px-2 py-2 text-right font-semibold">Fitting</th>
                    <th className="px-2 py-2 text-right font-semibold">Case</th>
                    <th className="px-2 py-2 text-right font-semibold">Fargo</th>
                    <th className="px-2 py-2 text-right font-semibold">Total</th>
                    <th className="px-2 py-2 text-left font-semibold">Billed By</th>
                    <th className="px-2 py-2 text-left font-semibold">Billed At</th>
                    <th className="px-2 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={14} className="text-center py-8 text-slate-400">Loading…</td></tr>}
                  {!loading && filteredRows.length === 0 && <tr><td colSpan={14} className="text-center py-8 text-slate-400">No orders found.</td></tr>}
                  {filteredRows.map((r) => (
                    <motion.tr key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="border-t border-slate-100 hover:bg-sky-50/40">
                      <td className="px-2 py-1.5 text-slate-400 tabular-nums">{r.index}</td>
                      <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[180px] truncate" title={r.patientName}>
                        {r.patientName}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[140px] truncate" title={r.lensType || ''}>
                        {r.lensType || '-'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[120px] truncate" title={r.frameCode || ''}>
                        {r.frameCode || '-'}
                      </td>
                      <td className="px-2 py-1.5"><StatusBadge status={r.billingStatus} /></td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.billing?.lenses != null ? money(r.billing.lenses) : '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.billing?.frame != null ? money(r.billing.frame) : '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.billing?.fitting != null ? money(r.billing.fitting) : '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.billing?.caseAmount != null ? money(r.billing.caseAmount) : '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{r.billing?.fargo != null ? money(r.billing.fargo) : '-'}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-sky-600 tabular-nums">{r.billing?.total != null ? money(r.billing.total) : '-'}</td>
                      <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap max-w-[140px] truncate" title={r.billing?.billedByName || ''}>
                        {r.billing?.billedByName || '-'}
                      </td>
                      <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                        {r.billing?.billedAt ? fmtDate(r.billing.billedAt) : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-right"><RowActions r={r} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ───────────── Batches Tab ───────────── */}
      {tab === 'batches' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
            <div className="relative md:col-span-6">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input className="input !py-2 !pl-8 !text-xs w-full"
                placeholder="Search batch #, patient, system no., submitter…"
                value={batchQuery} onChange={(e) => setBatchQuery(e.target.value)} />
            </div>
            <div className="relative md:col-span-4">
              <Filter size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select className="input !py-2 !pl-8 !pr-7 !text-xs appearance-none w-full"
                value={batchStatus} onChange={(e) => setBatchStatus(e.target.value)}>
                <option value="all">All batches</option>
                <option value="submitted">Submitted</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button onClick={loadBatches} className="btn-ghost !py-2 !px-2 !text-xs w-full md:w-auto">
                <RefreshCw size={12} className="inline mr-1" /> Refresh
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                    <th className="px-2 py-2 text-left font-semibold">Batch #</th>
                    <th className="px-2 py-2 text-left font-semibold">Submitted By</th>
                    <th className="px-2 py-2 text-left font-semibold">Submitted At</th>
                    <th className="px-2 py-2 text-right font-semibold">Orders</th>
                    <th className="px-2 py-2 text-right font-semibold">Orders Total</th>
                    <th className="px-2 py-2 text-right font-semibold">Fargo</th>
                    <th className="px-2 py-2 text-right font-semibold">Grand Total</th>
                    <th className="px-2 py-2 text-left font-semibold">Status</th>
                    <th className="px-2 py-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batchLoading && <tr><td colSpan={9} className="text-center py-8 text-slate-400">Loading…</td></tr>}
                  {!batchLoading && filteredBatches.length === 0 && (
                    <tr><td colSpan={9} className="text-center py-8 text-slate-400">No batches found.</td></tr>
                  )}
                  {filteredBatches.map((b) => {
                    const canPay = b.status === 'submitted';
                    const canRevert = b.status === 'paid';
                    const canCancel = b.status === 'submitted';
                    return (
                      <tr key={b._id} className="border-t border-slate-100 hover:bg-indigo-50/30">
                        <td className="px-2 py-2 font-mono text-[11px] font-semibold text-slate-800">{b.batchNumber}</td>
                        <td className="px-2 py-2 text-slate-600">{b.submittedByName || '-'}</td>
                        <td className="px-2 py-2 text-slate-500 whitespace-nowrap">
                          {b.submittedAt ? fmtDate(b.submittedAt) : '-'}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">{b.orderIds?.length ?? 0}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{money(b.ordersTotal)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{money(b.fargoAmount)}</td>
                        <td className="px-2 py-2 text-right font-bold text-indigo-600 tabular-nums">{money(b.grandTotal)}</td>
                        <td className="px-2 py-2"><BatchStatusBadge status={b.status} /></td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => setBatchDetails(b)}
                              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="View orders">
                              <Eye size={12} />
                            </button>
                            {canPay && (
                              <button onClick={() => setBatchAction({ batch: b, action: 'paid' })}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 text-[10px] font-semibold hover:bg-emerald-100 transition">
                                <CheckCircle2 size={10} /> Paid
                              </button>
                            )}
                            {canRevert && (
                              <button onClick={() => setBatchAction({ batch: b, action: 'revert' })}
                                className="rounded-md p-1 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Revert to submitted">
                                <Undo2 size={12} />
                              </button>
                            )}
                            {canCancel && (
                              <button onClick={() => setBatchAction({ batch: b, action: 'cancel' })}
                                className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Cancel batch">
                                <XCircle size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── Bill / Edit modal ─── */}
      <Modal open={!!editRow} onClose={closeEdit} title={editMode === 'bill' ? 'Enter Bill' : 'Edit Bill'} width="max-w-lg">
        <div className="space-y-3">
          <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-slate-500">Patient</span><span className="font-semibold text-slate-800">{editRow?.patientName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Lens Type</span><span className="font-semibold text-slate-800">{editRow?.lensType || '-'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Frame Code</span><span className="font-semibold text-slate-800">{editRow?.frameCode || '-'}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              ['lenses', 'Lenses Pair (KES)'],
              ['frame', 'Frame (KES)'],
              ['fitting', 'Fitting (KES)'],
              ['caseAmount', 'Case (KES)'],
              ['fargo', 'Fargo (KES)'],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input type="number" min="0" className="input"
                  value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="label">Total (auto)</label>
              <div className="input !bg-slate-50 !text-slate-700 font-semibold">{money(formTotal)}</div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={closeEdit} disabled={saving}>Cancel</button>
            <button className="btn-primary" onClick={saveBill} disabled={saving}>
              {saving ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><Wallet size={14} /> {editMode === 'bill' ? 'Submit Bill' : 'Save Changes'}</>}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Order confirm-action modal ─── */}
      <Modal open={!!actionRow} onClose={closeAction} title="Confirm" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            {actionType === 'paid' ? <CheckCircle2 className="text-emerald-600" size={22} /> :
             actionType === 'deliver' ? <Truck className="text-violet-600" size={22} /> :
             <Undo2 className="text-amber-600" size={22} />}
          </div>
          <div className="text-center text-sm text-slate-700">
            {actionType === 'paid' && <>Mark <strong>{actionRow?.patientName}</strong> as paid?</>}
            {actionType === 'deliver' && <>Mark <strong>{actionRow?.patientName}</strong> as delivered?</>}
            {actionType === 'revert-pending' && <>Revert <strong>{actionRow?.patientName}</strong> to pending? The bill will be cleared.</>}
            {actionType === 'revert-billed' && <>Revert <strong>{actionRow?.patientName}</strong> to billed (unpaid)?</>}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={closeAction} disabled={actionWorking}>Cancel</button>
            <button className="btn-primary" onClick={runAction} disabled={actionWorking}>
              {actionWorking ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Batch confirm-action modal ─── */}
      <Modal open={!!batchAction} onClose={() => !actionWorking && setBatchAction(null)} title="Confirm batch action" width="max-w-md">
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-indigo-50 grid place-items-center">
            {batchAction?.action === 'cancel' ? <XCircle className="text-rose-600" size={22} /> :
             batchAction?.action === 'revert' ? <Undo2 className="text-amber-600" size={22} /> :
             <CheckCircle2 className="text-emerald-600" size={22} />}
          </div>
          <div className="text-center text-sm text-slate-700">
            {batchAction?.action === 'paid' && (
              <>Mark batch <strong>{batchAction.batch.batchNumber}</strong> as paid? All {batchAction.batch.orderIds?.length ?? 0} orders will flip to <em>paid</em>.</>
            )}
            {batchAction?.action === 'revert' && (
              <>Revert batch <strong>{batchAction.batch.batchNumber}</strong> to submitted? All orders will flip back to <em>submitted to director</em>.</>
            )}
            {batchAction?.action === 'cancel' && (
              <>Cancel batch <strong>{batchAction.batch.batchNumber}</strong>? All orders will revert to <em>billed (draft)</em> and become editable again.</>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setBatchAction(null)} disabled={actionWorking}>Cancel</button>
            <button className="btn-primary" onClick={runBatchAction} disabled={actionWorking}>
              {actionWorking ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Batch details modal ─── */}
      <Modal open={!!batchDetails} onClose={() => setBatchDetails(null)} title={`Batch ${batchDetails?.batchNumber || ''}`} width="max-w-3xl">
        {batchDetails && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Status</p>
                <div className="mt-0.5"><BatchStatusBadge status={batchDetails.status} /></div>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Orders</p>
                <p className="font-bold text-slate-800">{batchDetails.orderIds?.length ?? 0}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Fargo</p>
                <p className="font-bold text-rose-600">{money(batchDetails.fargoAmount)}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-2">
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Grand Total</p>
                <p className="font-bold text-indigo-600">{money(batchDetails.grandTotal)}</p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase">
                    <th className="px-2 py-1.5 text-left font-semibold">Patient</th>
                    <th className="px-2 py-1.5 text-left font-semibold">System No.</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Lens</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(batchDetails.orderIds || []).map((o) => (
                    <tr key={o._id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-semibold text-slate-800">{o.name || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-500">{o.systemNumber || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-500">{o.lensType || '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(o.billing?.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-1">
              <button className="btn-ghost" onClick={() => setBatchDetails(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} title="Success" message={successMsg} />
    </div>
  );
};

export default Billing;