import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Filter, Calendar, Wallet, CheckCircle2, Package, Clock,
  ClipboardList, Pencil, Undo2, Truck,
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
  pending_billing: { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 border-amber-200',   icon: Clock },
  billed:          { label: 'Billed',    cls: 'bg-sky-50 text-sky-700 border-sky-200',          icon: Wallet },
  paid:            { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  delivered:       { label: 'Delivered', cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: Package },
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

const Billing = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  /* Bill / Edit modal */
  const [editRow, setEditRow] = useState(null);
  const [editMode, setEditMode] = useState(null); // 'bill' | 'edit'
  const [form, setForm] = useState({ lenses: '', frame: '', fitting: '', caseAmount: '', fargo: '' });
  const [saving, setSaving] = useState(false);

  /* Confirm modals */
  const [actionRow, setActionRow] = useState(null);
  const [actionType, setActionType] = useState(null); // 'paid' | 'deliver' | 'revert-pending' | 'revert-billed'
  const [actionWorking, setActionWorking] = useState(false);

  /* Success modal */
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

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

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

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

  /* ─── Bill / Edit modal handlers ─── */
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

  /* ─── Simple-action modals ─── */
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

  /* ─── Exports (unchanged) ─── */
  const subtitleParts = [];
  if (status !== 'all') subtitleParts.push(status.replace('_', ' '));
  if (from) subtitleParts.push(`from ${from}`);
  if (to) subtitleParts.push(`to ${to}`);
  if (q) subtitleParts.push(`search "${q}"`);

  const exportCsv = () => {
    const header = [
      'Index', 'Patient', 'System No.', 'Lens Type', 'Frame Code',
      'Billing Status', 'Lenses', 'Frame', 'Fitting', 'Case', 'Fargo', 'Total',
      'Billed By', 'Billed At', 'Paid At',
    ];
    const rows = filteredRows.map((r) => [
      r.index, r.patientName, r.systemNumber, r.lensType, r.frameCode || '',
      r.billingStatus,
      r.billing?.lenses ?? '', r.billing?.frame ?? '', r.billing?.fitting ?? '',
      r.billing?.caseAmount ?? '', r.billing?.fargo ?? '', r.billing?.total ?? '',
      r.billing?.billedByName || '', r.billing?.billedAt ? fmtDate(r.billing.billedAt) : '',
      r.billing?.paidAt ? fmtDate(r.billing.paidAt) : '',
    ]);
    const csv = [header, ...rows]
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
        { label: 'Pending', value: s.pendingCount ?? 0 },
        { label: 'Billed', value: s.billedCount ?? 0 },
        { label: 'Paid', value: s.paidCount ?? 0 },
        { label: 'Delivered', value: s.deliveredCount ?? 0 },
        { label: 'Billed Total', value: money(s.billedTotal) },
        { label: 'Paid Total', value: money(s.paidTotal) },
        { label: 'Grand Total', value: money(s.grandTotal) },
      ],
      grouped: [
        { label: 'Status filter', value: status === 'all' ? 'All statuses' : status },
        { label: 'Date range', value: `${from || 'Any'} → ${to || 'Any'}` },
        { label: 'Search term', value: q || '-' },
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
    exportTablePdf({
      title: 'Billing Table',
      subtitle: subtitleParts.join(' · ') || 'All orders',
      columns,
      rows: pdfRows,
    });
  };

  const cards = useMemo(() => summary ? [
    { label: 'Pending', value: summary.pendingCount, cls: 'text-amber-600' },
    { label: 'Billed', value: summary.billedCount, cls: 'text-sky-600' },
    { label: 'Paid', value: summary.paidCount, cls: 'text-emerald-600' },
    { label: 'Delivered', value: summary.deliveredCount, cls: 'text-violet-600' },
    { label: 'Billed Total', value: money(summary.billedTotal), cls: 'text-sky-700' },
    { label: 'Paid Total', value: money(summary.paidTotal), cls: 'text-emerald-700' },
    { label: 'Grand Total', value: money(summary.grandTotal), cls: 'text-slate-900' },
  ] : [], [summary]);

  /* ─── Per-row action button ─── */
  const RowActions = ({ r }) => {
    const status = r.billingStatus;
    if (status === 'pending_billing') {
      return (
        <button onClick={() => openBill(r)}
          className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-2 py-1 text-[10px] font-semibold hover:shadow-md hover:-translate-y-0.5 transition">
          <ClipboardList size={10} /> Bill
        </button>
      );
    }
    if (status === 'billed') {
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
    if (status === 'paid') {
      return (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(r)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit bill">
            <Pencil size={12} />
          </button>
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
    if (status === 'delivered') {
      return (
        <button onClick={() => openEdit(r)}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit bill">
          <Pencil size={12} />
        </button>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Billing</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Full billing control - bill, edit, mark paid, deliver, or revert any order.
          </p>
        </div>
        <ExportMenu
          onCsv={exportCsv}
          onPdfSummary={exportPdfSummary}
          onPdfTable={exportPdfTable}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }} className="card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className={`text-lg font-extrabold mt-0.5 ${c.cls}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>

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
            <option value="billed">Billed</option>
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

      {/* ─── Bill / Edit modal ─── */}
      <Modal
        open={!!editRow}
        onClose={closeEdit}
        title={editMode === 'bill' ? 'Enter Bill' : 'Edit Bill'}
        width="max-w-lg"
      >
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

      {/* ─── Confirm-action modal ─── */}
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

      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} title="Success" message={successMsg} />
    </div>
  );
};

export default Billing;
 