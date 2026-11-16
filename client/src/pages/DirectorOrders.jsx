import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CheckCircle2, Package, Wallet, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import ExportMenu from '../components/ExportMenu.jsx';
import { exportSummaryPdf, exportTablePdf } from '../lib/pdf.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const StatusPill = ({ status }) => {
  const map = {
    submitted: { label: 'Submitted', cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: Wallet },
    paid:      { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: Package },
  };
  const s = map[status] || map.submitted;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      <Icon size={10} /> {s.label}
    </span>
  );
};

const DirectorOrders = ({ mode = 'unpaid' }) => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [paidTarget, setPaidTarget] = useState(null);
  const [working, setWorking] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const status = mode === 'paid' ? 'paid' : mode === 'new' ? 'unpaid' : 'unpaid';
  const title = mode === 'paid' ? 'Paid Batches' : mode === 'new' ? 'New Batches' : 'Unpaid Batches';
  const subtitle = mode === 'paid'
    ? 'Batches with confirmed payment.'
    : 'Submitted batches awaiting payment confirmation.';

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/billing/director/batches', { params: { q, status } });
      setBatches(r.data);
    } catch {
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const markPaid = async () => {
    if (!paidTarget) return;
    setWorking(true);
    try {
      await api.post(`/billing/director/batches/${paidTarget._id}/paid`);
      setSuccessMsg(`Batch ${paidTarget.batchNumber} marked paid.`);
      setPaidTarget(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Update failed');
    } finally { setWorking(false); }
  };

  /* Exports */
  const total = batches.reduce((s, b) => s + (b.grandTotal || 0), 0);

  const exportCsv = () => {
    const header = ['Batch No.', 'Submitted', 'Orders', 'Orders Subtotal', 'Fargo', 'Grand Total', 'Status'];
    const rows = batches.map((b) => [
      b.batchNumber,
      fmtDate(b.submittedAt),
      b.orderIds?.length || 0,
      b.ordersTotal,
      b.fargoAmount,
      b.grandTotal,
      b.status,
    ]);
    const grand = batches.reduce((s, b) => s + (b.grandTotal || 0), 0);
    rows.push(['', '', '', '', '', grand, 'GRAND TOTAL']);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `director-${mode}-batches-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdfSummary = () => {
    exportSummaryPdf({
      title: `${title} Summary`,
      subtitle,
      stats: [
        { label: 'Batches', value: batches.length },
        { label: 'Total Amount', value: money(total) },
      ],
      grouped: [
        { label: 'Filter', value: status },
        { label: 'Search term', value: q || '-' },
      ],
    });
  };

  const exportPdfTable = () => {
    const columns = ['Batch', 'Submitted', 'Orders', 'Orders Total', 'Fargo', 'Grand Total', 'Status'];
    const rows = batches.map((b) => [
      b.batchNumber,
      fmtDate(b.submittedAt),
      b.orderIds?.length || 0,
      money(b.ordersTotal),
      money(b.fargoAmount),
      money(b.grandTotal),
      b.status,
    ]);
    const grand = batches.reduce((s, b) => s + (b.grandTotal || 0), 0);
    rows.push([
      { content: '', styles: { fontStyle: 'bold' } },
      { content: '', styles: { fontStyle: 'bold' } },
      { content: '', styles: { fontStyle: 'bold' } },
      { content: '', styles: { fontStyle: 'bold' } },
      { content: 'GRAND TOTAL', styles: { fontStyle: 'bold' } },
      { content: money(grand), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: '', styles: { fontStyle: 'bold' } },
    ]);
    exportTablePdf({
      title: `${title} Table`,
      subtitle,
      columns,
      rows,
      fontSize: 11,
      headerFontSize: 11.5,
      cellPadding: 2.2,
      orientation: 'portrait',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <ExportMenu onCsv={exportCsv} onPdfSummary={exportPdfSummary} onPdfTable={exportPdfTable} />
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input !py-2 !pl-8 !text-xs" placeholder="Search patient, system no., batch no…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-2 w-8"></th>
                <th className="px-2 py-2 text-left font-semibold">Batch</th>
                <th className="px-2 py-2 text-left font-semibold">Submitted</th>
                <th className="px-2 py-2 text-left font-semibold">Billed By</th>
                <th className="px-2 py-2 text-right font-semibold">Orders</th>
                <th className="px-2 py-2 text-right font-semibold">Fargo</th>
                <th className="px-2 py-2 text-right font-semibold">Grand Total</th>
                <th className="px-2 py-2 text-left font-semibold">Status</th>
                <th className="px-2 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="text-center py-8 text-slate-400">Loading…</td></tr>}
              {!loading && batches.length === 0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">No batches.</td></tr>}
              {batches.map((b) => {
                const isOpen = expanded.has(b._id);
                return (
                  <>
                    <motion.tr
                      key={b._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-t border-slate-100 hover:bg-sky-50/40 cursor-pointer"
                      onClick={() => toggleExpand(b._id)}
                    >
                      <td className="px-2 py-1.5 text-slate-400">
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </td>
                      <td className="px-2 py-1.5 font-mono font-semibold text-slate-800 whitespace-nowrap">{b.batchNumber}</td>
                      <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">{fmtDate(b.submittedAt)}</td>
                      <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{b.submittedByName || '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{b.orderIds?.length || 0}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(b.fargoAmount)}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-sky-600 tabular-nums">{money(b.grandTotal)}</td>
                      <td className="px-2 py-1.5"><StatusPill status={b.status} /></td>
                      <td className="px-2 py-1.5 text-right">
                        {mode !== 'paid' && b.status === 'submitted' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setPaidTarget(b); }}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 text-[10px] font-semibold hover:bg-emerald-100 transition"
                          >
                            <CheckCircle2 size={10} /> Mark Paid
                          </button>
                        )}
                      </td>
                    </motion.tr>
                    <AnimatePresence>
                      {isOpen && (
                        <tr>
                          <td colSpan={9} className="bg-slate-50/50 px-2 py-2">
                            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold px-2 py-1">Orders in this batch</div>
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="text-[10px] uppercase tracking-wider text-slate-400">
                                  <th className="px-2 py-1 text-left">#</th>
                                  <th className="px-2 py-1 text-left">Patient</th>
                                  <th className="px-2 py-1 text-left">Sys No.</th>
                                  <th className="px-2 py-1 text-left">Lens</th>
                                  <th className="px-2 py-1 text-right">Bill Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(b.orderIds || []).map((o, idx) => (
                                  <tr key={o._id} className="border-t border-slate-100">
                                    <td className="px-2 py-1 text-slate-400 tabular-nums">{idx + 1}</td>
                                    <td className="px-2 py-1 font-semibold text-slate-800">{o.name}</td>
                                    <td className="px-2 py-1 text-slate-600 font-mono">{o.systemNumber}</td>
                                    <td className="px-2 py-1 text-slate-600">{o.lensType || '-'}</td>
                                    <td className="px-2 py-1 text-right tabular-nums">{money(o.billing?.total)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!paidTarget} onClose={() => !working && setPaidTarget(null)} title="Mark Batch Paid" width="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Mark batch <strong className="font-mono">{paidTarget?.batchNumber}</strong> as paid?
          </p>
          <p className="text-xs text-slate-500">
            {paidTarget?.orderIds?.length} order(s) totaling <strong>{money(paidTarget?.grandTotal)}</strong> will be marked as paid.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setPaidTarget(null)} disabled={working}>Cancel</button>
            <button className="btn-primary" onClick={markPaid} disabled={working}>
              {working ? <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <><CheckCircle2 size={14} /> Confirm</>}
            </button>
          </div>
        </div>
      </Modal>

      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} title="Success" message={successMsg} />
    </div>
  );
};

export default DirectorOrders;