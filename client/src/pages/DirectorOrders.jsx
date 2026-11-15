import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, CheckCircle2, Package, Wallet, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import ExportMenu from '../components/ExportMenu.jsx';
import { exportSummaryPdf, exportTablePdf } from '../lib/pdf.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

/* ── Status pill ── */
const StatusPill = ({ status }) => {
  const map = {
    pending_billing: { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 border-amber-200',     icon: Wallet },
    billed:          { label: 'Billed',    cls: 'bg-sky-50 text-sky-700 border-sky-200',           icon: Wallet },
    paid:            { label: 'Paid',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
    delivered:       { label: 'Delivered', cls: 'bg-violet-50 text-violet-700 border-violet-200',  icon: Truck },
  };
  const s = map[status] || { label: status || '-', cls: 'bg-slate-100 text-slate-500 border-slate-200', icon: Package };
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>
      <Icon size={10} />
      {s.label}
    </span>
  );
};

const DirectorOrders = ({ mode = 'unpaid' }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [paidTarget, setPaidTarget] = useState(null);
  const [working, setWorking] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const status = mode === 'paid' ? 'paid' : mode === 'new' ? 'unpaid' : 'unpaid';
  const title = mode === 'paid' ? 'Paid Orders' : mode === 'new' ? 'New Orders' : 'Unpaid Orders';
  const subtitle = mode === 'paid'
    ? 'Orders with a confirmed payment.'
    : 'Billed orders awaiting payment confirmation.';

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/billing/director/orders', { params: { q, status } });
      setRows(r.data);
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
  }, [q, status]);

  const markPaid = async () => {
    setWorking(true);
    try {
      await api.post(`/billing/director/${paidTarget._id}/paid`);
      setSuccessMsg(`${paidTarget.patientName} marked paid.`);
      setPaidTarget(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Paid update failed');
    } finally {
      setWorking(false);
    }
  };

  /* ─── Exports ─── */
  const total = rows.reduce((s, r) => s + (r.billing?.total || 0), 0);

  const exportCsv = () => {
    const header = ['#', 'Patient Name', 'Lens Type', 'Frame Code', 'Total'];
    const csvRows = rows.map((r) => [
      r.index,
      r.patientName || '',
      r.lensType || '',
      r.frameCode || '',
      r.billing?.total ?? 0,
    ]);

    const grandTotal = rows.reduce((s, r) => s + (r.billing?.total || 0), 0);
    csvRows.push(['', '', '', 'GRAND TOTAL', grandTotal]);

    const csv = [header, ...csvRows]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `director-${mode}-orders-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdfSummary = () => {
    exportSummaryPdf({
      title: `${title} Summary`,
      subtitle: subtitle,
      stats: [
        { label: 'Orders', value: rows.length },
        { label: 'Total Amount', value: money(total) },
      ],
      grouped: [
        { label: 'Filter', value: status },
        { label: 'Search term', value: q || '-' },
      ],
    });
  };

  const exportPdfTable = () => {
    const columns = ['#', 'Patient Name', 'Lens Type', 'Frame Code', 'Total'];
    const pdfRows = rows.map((r) => [
      r.index,
      r.patientName || '-',
      r.lensType || '-',
      r.frameCode || '-',
      money(r.billing?.total),
    ]);

    const grandTotal = rows.reduce((s, r) => s + (r.billing?.total || 0), 0);
    pdfRows.push([
      { content: '', styles: { fontStyle: 'bold' } },
      { content: '', styles: { fontStyle: 'bold' } },
      { content: '', styles: { fontStyle: 'bold' } },
      { content: 'GRAND TOTAL', styles: { fontStyle: 'bold' } },
      { content: money(grandTotal), styles: { fontStyle: 'bold', halign: 'right' } },
    ]);

    exportTablePdf({
      title: `${title} Table`,
      subtitle: subtitle,
      columns,
      rows: pdfRows,
      fontSize: 11,
      headerFontSize: 11.5,
      cellPadding: 2.2,
      orientation: 'portrait',
    });
  };

  const colCount = 7; // both pages now have 7 columns (#, Patient, Sys, Billed By, Total, Billed At, Status/Actions)

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        <ExportMenu
          onCsv={exportCsv}
          onPdfSummary={exportPdfSummary}
          onPdfTable={exportPdfTable}
        />
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !py-2 !pl-8 !text-xs"
          placeholder="Search patient, system no., lens…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs table-fixed">
            <colgroup>
              <col style={{ width: '4%' }} />
              <col style={{ width: '32%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Patient</th>
                <th className="px-2 py-2 text-left font-semibold">Sys No.</th>
                <th className="px-2 py-2 text-left font-semibold">Billed By</th>
                <th className="px-2 py-2 text-right font-semibold">Total</th>
                <th className="px-2 py-2 text-left font-semibold">Billed At</th>
                <th className="px-2 py-2 text-right font-semibold">
                  {mode === 'paid' ? 'Status' : 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={colCount} className="text-center py-8 text-slate-400">Loading…</td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={colCount} className="text-center py-8 text-slate-400">No orders.</td>
                </tr>
              )}
              {rows.map((p) => (
                <motion.tr
                  key={p._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t border-slate-100 hover:bg-sky-50/40"
                >
                  <td className="px-2 py-1.5 text-slate-400 tabular-nums">{p.index}</td>
                  <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap truncate" title={p.patientName}>
                    {p.patientName}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap truncate">{p.systemNumber}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap truncate" title={p.billing?.billedByName || ''}>
                    {p.billing?.billedByName || '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-bold text-sky-600 tabular-nums whitespace-nowrap">
                    {money(p.billing?.total)}
                  </td>
                  <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                    {p.billing?.billedAt ? fmtDate(p.billing.billedAt) : '-'}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {mode === 'paid' ? (
                      <StatusPill status={p.billingStatus} />
                    ) : (
                      <button
                        onClick={() => setPaidTarget(p)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 text-[10px] font-semibold hover:bg-emerald-100 transition whitespace-nowrap"
                      >
                        <CheckCircle2 size={10} /> Mark Paid
                      </button>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={!!paidTarget}
        onClose={() => !working && setPaidTarget(null)}
        title="Mark Paid"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Confirm payment received for <span className="font-semibold">{paidTarget?.patientName}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setPaidTarget(null)} disabled={working}>Cancel</button>
            <button className="btn-primary" onClick={markPaid} disabled={working}>
              {working ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><CheckCircle2 size={14} /> Confirm</>
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

export default DirectorOrders;