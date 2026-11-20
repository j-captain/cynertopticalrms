import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Truck, ChevronDown, ChevronRight, ShieldAlert, Wallet, Package,
  CheckCircle2, Layers, ListOrdered, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const Stat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 px-2 py-1.5">
    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</p>
    <p className="font-semibold text-slate-800">{value}</p>
  </div>
);

const SummaryCard = ({ icon: Icon, label, value, accent }) => (
  <div className="card p-3 flex items-center gap-3">
    <div className={`h-9 w-9 rounded-xl grid place-items-center ${accent}`}>
      <Icon size={16} />
    </div>
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{label}</p>
      <p className="text-sm font-extrabold text-slate-800">{value}</p>
    </div>
  </div>
);

const ModeButton = ({ active, icon: Icon, label, sublabel, onClick, accent }) => (
  <button
    onClick={onClick}
    className={`group relative flex-1 min-w-[220px] text-left rounded-2xl border-2 p-4 transition-all duration-300 ${
      active
        ? `${accent.activeBorder} ${accent.activeBg} shadow-lg ${accent.shadow}`
        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
    }`}
  >
    <div className="flex items-start gap-3">
      <div
        className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 transition-transform duration-300 ${
          active ? accent.activeIcon : 'bg-slate-100 text-slate-500 group-hover:scale-110'
        }`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-extrabold ${active ? accent.activeText : 'text-slate-800'}`}>{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{sublabel}</p>
      </div>
      <ArrowRight
        size={16}
        className={`mt-2 shrink-0 transition-all duration-300 ${
          active ? `${accent.activeText} translate-x-0` : 'text-slate-300 -translate-x-1 group-hover:translate-x-0'
        }`}
      />
    </div>
    {active && (
      <span className={`absolute top-2 right-2 text-[9px] uppercase tracking-widest font-bold rounded-full px-2 py-0.5 ${accent.badge}`}>
        Active
      </span>
    )}
  </button>
);

const UndeliveredOrders = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState({ batches: [], individual: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(new Set());

  /* Delivery mode: 'batch' | 'single' */
  const [mode, setMode] = useState('batch');

  const [actionTarget, setActionTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/billing/undelivered', { params: { q } });
      setData(r.data || { batches: [], individual: [], summary: {} });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load undelivered orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runAction = async () => {
    if (!actionTarget) return;
    setProcessing(true);
    try {
      const res = await actionTarget.run();
      setSuccessMsg(actionTarget.successMessage || res?.data?.message || 'Done');
      setActionTarget(null);
      setSuccessOpen(true);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || actionTarget.errorMessage || 'Action failed');
    } finally {
      setProcessing(false);
    }
  };

  /* Action builders */
  const askDeliverBatch = (b) => setActionTarget({
    type: 'deliver-batch',
    label: 'Deliver Batch',
    description: `Mark all ${b.outstandingOrders} outstanding order(s) in batch ${b.batchNumber} as delivered?`,
    run: () => api.post(`/billing/undelivered/batch/${b._id}/deliver`),
    successMessage: `Batch ${b.batchNumber} delivered.`,
  });

  const askDeliverIndividual = (o) => setActionTarget({
    type: 'deliver-individual',
    label: 'Deliver Order',
    description: `Mark ${o.patientName} (${o.systemNumber}) as delivered?`,
    run: () => api.post(`/billing/undelivered/order/${o._id}/deliver`),
    successMessage: `${o.patientName} marked delivered.`,
  });

  const askBatchPaid = (b) => setActionTarget({
    type: 'batch-paid',
    label: 'Mark Batch Paid',
    description: `Mark batch ${b.batchNumber} as paid? This flips all its orders to paid.`,
    run: () => api.post(`/billing/admin/batches/${b._id}/action`, { action: 'paid' }),
    successMessage: `Batch ${b.batchNumber} marked paid.`,
  });

  const askBatchRevert = (b) => setActionTarget({
    type: 'batch-revert',
    label: 'Revert Batch to Submitted',
    description: `Revert batch ${b.batchNumber} to submitted? Orders will no longer be paid.`,
    run: () => api.post(`/billing/admin/batches/${b._id}/action`, { action: 'revert' }),
    successMessage: `Batch ${b.batchNumber} reverted to submitted.`,
  });

  const askBatchCancel = (b) => setActionTarget({
    type: 'batch-cancel',
    label: 'Cancel Batch',
    description: `Cancel batch ${b.batchNumber}? Its outstanding orders will be returned to draft billed.`,
    run: () => api.post(`/billing/batches/${b._id}/cancel`),
    successMessage: `Batch ${b.batchNumber} cancelled.`,
  });

  const askOrderPaid = (o) => setActionTarget({
    type: 'order-paid',
    label: 'Mark Order Paid',
    description: `Mark ${o.patientName} (${o.systemNumber}) as paid?`,
    run: () => api.post(`/billing/admin/${o._id}/paid`),
    successMessage: `${o.patientName} marked paid.`,
  });

  const askOrderRevertBilled = (o) => setActionTarget({
    type: 'order-revert-billed',
    label: 'Revert to Billed',
    description: `Revert ${o.patientName} (${o.systemNumber}) back to billed?`,
    run: () => api.post(`/billing/admin/${o._id}/revert-billed`),
    successMessage: `${o.patientName} reverted to billed.`,
  });

  const summary = data.summary || {};
  const batches = data.batches || [];
  const rawIndividual = data.individual || [];

  const batchStatusStyles = useMemo(() => ({
    submitted: 'bg-sky-50 text-sky-700 border-sky-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }), []);

  /*
   * Flat list of every undelivered order (batch + individual, deduped).
   * Powers the one-by-one table.
   */
  const allOutstandingOrders = useMemo(() => {
    const seen = new Set();
    const out = [];

    for (const b of batches) {
      for (const o of (b.orders || [])) {
        if (seen.has(String(o._id))) continue;
        seen.add(String(o._id));
        out.push({
          _id: o._id,
          patientName: o.name,
          systemNumber: o.systemNumber,
          lensType: o.lensType,
          scheme: o.scheme,
          billingStatus: o.billingStatus,
          total: o.total ?? 0,
          batchId: b._id,
          batchNumber: b.batchNumber,
          batchStatus: b.status,
        });
      }
    }

    for (const o of rawIndividual) {
      if (seen.has(String(o._id))) continue;
      seen.add(String(o._id));
      out.push({
        _id: o._id,
        patientName: o.patientName,
        systemNumber: o.systemNumber,
        lensType: o.lensType,
        scheme: o.scheme,
        billingStatus: o.billingStatus,
        total: o.billing?.total ?? 0,
        batchId: null,
        batchNumber: null,
        batchStatus: null,
      });
    }

    return out;
  }, [batches, rawIndividual]);

  const accentBatch = {
    activeBorder: 'border-sky-400',
    activeBg: 'bg-gradient-to-br from-sky-50 via-white to-indigo-50',
    shadow: 'shadow-sky-200/60',
    activeIcon: 'bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-md',
    activeText: 'text-sky-700',
    badge: 'bg-sky-500 text-white',
  };

  const accentSingle = {
    activeBorder: 'border-violet-400',
    activeBg: 'bg-gradient-to-br from-violet-50 via-white to-fuchsia-50',
    shadow: 'shadow-violet-200/60',
    activeIcon: 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md',
    activeText: 'text-violet-700',
    badge: 'bg-violet-500 text-white',
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Undelivered Orders</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Submitted or paid orders that have not yet been handed to the patient.
        </p>
      </div>

      {/* Summary strip — admin only */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <SummaryCard icon={Package} label="Undelivered Orders" value={summary.totalUndeliveredOrders || 0} accent="bg-sky-50 text-sky-600" />
          <SummaryCard icon={Truck} label="Live Batches" value={summary.totalLiveBatches || 0} accent="bg-indigo-50 text-indigo-600" />
          <SummaryCard icon={CheckCircle2} label="Individual" value={summary.totalIndividual || 0} accent="bg-violet-50 text-violet-600" />
          <SummaryCard icon={Wallet} label="Total Value" value={money(summary.totalValue || 0)} accent="bg-emerald-50 text-emerald-600" />
        </div>
      )}

      {/* Mode selector */}
      <div className="flex flex-col md:flex-row gap-3">
        <ModeButton
          active={mode === 'batch'}
          icon={Layers}
          label="Deliver by Batch"
          sublabel="Hand over every outstanding order in a submitted batch at once."
          onClick={() => setMode('batch')}
          accent={accentBatch}
        />
        <ModeButton
          active={mode === 'single'}
          icon={ListOrdered}
          label="Deliver One by One"
          sublabel="Pick individual orders and hand them over one at a time."
          onClick={() => setMode('single')}
          accent={accentSingle}
        />
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !py-2 !pl-8 !text-xs"
          placeholder="Search patient, system no., lens, frame…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <AnimatePresence mode="wait">
        {mode === 'batch' && (
          <motion.div
            key="batch-mode"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800">Batches</h2>
              <span className="text-xs text-slate-500">{batches.length}</span>
            </div>

            {loading && <div className="card p-6 text-center text-slate-400 text-sm">Loading…</div>}
            {!loading && batches.length === 0 && (
              <div className="card p-6 text-center text-slate-400 text-sm">No live batches.</div>
            )}

            {batches.map((b) => {
              const isOpen = expanded.has(b._id);
              return (
                <motion.div
                  key={b._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card p-3 space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-mono text-sm font-bold text-slate-800">{b.batchNumber}</p>
                        <span className={`text-[10px] uppercase tracking-wider font-bold rounded-full border px-2 py-0.5 ${batchStatusStyles[b.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          {b.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Submitted by {b.submittedByName || '-'} · {b.submittedAt ? fmtDate(b.submittedAt) : '-'}
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-slate-500">Grand total</p>
                      <p className="font-bold text-sky-600">{money(b.grandTotal)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <Stat label="Outstanding" value={`${b.outstandingOrders}/${b.totalOrders}`} />
                    <Stat label="Orders total" value={money(b.ordersTotal)} />
                    <Stat label="Fargo" value={money(b.fargoAmount)} />
                    <Stat label="Orders left" value={b.outstandingOrders} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => askDeliverBatch(b)}
                      className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-2.5 py-1.5 text-[11px] font-bold hover:from-sky-600 hover:to-indigo-600 transition"
                    >
                      <Truck size={12} /> Deliver Batch
                    </button>

                    {isAdmin && b.status === 'submitted' && (
                      <button
                        onClick={() => askBatchPaid(b)}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-200 text-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-emerald-50 transition"
                      >
                        Mark Paid
                      </button>
                    )}
                    {isAdmin && b.status === 'paid' && (
                      <button
                        onClick={() => askBatchRevert(b)}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-amber-200 text-amber-700 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-amber-50 transition"
                      >
                        Revert to Submitted
                      </button>
                    )}
                    {isAdmin && b.status === 'submitted' && (
                      <button
                        onClick={() => askBatchCancel(b)}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-red-200 text-red-600 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-red-50 transition"
                      >
                        Cancel Batch
                      </button>
                    )}

                    <button
                      onClick={() => toggleExpand(b._id)}
                      className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-600 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-slate-50 transition"
                    >
                      {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      {isOpen ? 'Hide' : 'Show'} orders
                    </button>
                  </div>

                  {isOpen && (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                      <table className="min-w-full text-xs">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                          <tr>
                            <th className="px-2 py-1.5 text-left font-semibold">#</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Patient</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Sys No.</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Lens</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Scheme</th>
                            <th className="px-2 py-1.5 text-right font-semibold">Total</th>
                            <th className="px-2 py-1.5 text-left font-semibold">Status</th>
                            <th className="px-2 py-1.5 text-right font-semibold">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.orders.map((o, i) => {
                            const flat = {
                              _id: o._id,
                              patientName: o.name,
                              systemNumber: o.systemNumber,
                            };
                            return (
                              <tr key={o._id} className="border-t border-slate-100">
                                <td className="px-2 py-1.5 text-slate-400 tabular-nums">{i + 1}</td>
                                <td className="px-2 py-1.5 font-semibold text-slate-800">{o.name}</td>
                                <td className="px-2 py-1.5 text-slate-600 font-mono">{o.systemNumber}</td>
                                <td className="px-2 py-1.5 text-slate-600">{o.lensType || '-'}</td>
                                <td className="px-2 py-1.5 text-slate-600">{o.scheme || '-'}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{money(o.total)}</td>
                                <td className="px-2 py-1.5">
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                    {o.billingStatus}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 text-right">
                                  <button
                                    onClick={() => askDeliverIndividual(flat)}
                                    className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-600 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 transition"
                                  >
                                    <Truck size={10} /> Deliver
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {mode === 'single' && (
          <motion.div
            key="single-mode"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="card overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-800">All Undelivered Orders</h2>
              <span className="text-xs text-slate-500">{allOutstandingOrders.length}</span>
            </div>

            {loading && <div className="p-6 text-center text-slate-400 text-sm">Loading…</div>}

            {!loading && allOutstandingOrders.length === 0 && (
              <div className="p-10 text-center space-y-2">
                <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 grid place-items-center">
                  <CheckCircle2 className="text-emerald-600" size={22} />
                </div>
                <p className="text-sm font-bold text-slate-800">All caught up!</p>
                <p className="text-xs text-slate-500">Every order has been delivered.</p>
              </div>
            )}

            {!loading && allOutstandingOrders.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                      <th className="px-2 py-2 text-left font-semibold">#</th>
                      <th className="px-2 py-2 text-left font-semibold">Patient</th>
                      <th className="px-2 py-2 text-left font-semibold">Sys No.</th>
                      <th className="px-2 py-2 text-left font-semibold">Lens</th>
                      <th className="px-2 py-2 text-left font-semibold">Scheme</th>
                      <th className="px-2 py-2 text-left font-semibold">Batch</th>
                      <th className="px-2 py-2 text-right font-semibold">Total</th>
                      <th className="px-2 py-2 text-left font-semibold">Status</th>
                      <th className="px-2 py-2 text-right font-semibold">Deliver</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allOutstandingOrders.map((o, i) => (
                      <motion.tr
                        key={o._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-t border-slate-100 hover:bg-violet-50/40"
                      >
                        <td className="px-2 py-1.5 text-slate-400 tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[160px] truncate" title={o.patientName}>
                          {o.patientName}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 font-mono whitespace-nowrap">{o.systemNumber}</td>
                        <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[160px] truncate" title={o.lensType || ''}>
                          {o.lensType || '-'}
                        </td>
                        <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{o.scheme || '-'}</td>
                        <td className="px-2 py-1.5 text-slate-500 font-mono text-[10px] whitespace-nowrap">
                          {o.batchNumber || '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{money(o.total)}</td>
                        <td className="px-2 py-1.5">
                          <span className={`text-[10px] uppercase tracking-wider font-bold rounded-full border px-2 py-0.5 ${
                            o.billingStatus === 'paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-sky-50 text-sky-700 border-sky-200'
                          }`}>
                            {o.billingStatus}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            <button
                              onClick={() => askDeliverIndividual(o)}
                              className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white px-2.5 py-1 text-[10px] font-bold hover:from-violet-600 hover:to-fuchsia-600 transition shadow-sm shadow-violet-500/30"
                            >
                              <Truck size={10} /> Deliver
                            </button>
                            {isAdmin && o.billingStatus === 'submitted_to_director' && (
                              <button
                                onClick={() => askOrderPaid(o)}
                                className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-200 text-emerald-700 px-2 py-1 text-[10px] font-semibold hover:bg-emerald-50 transition"
                              >
                                Mark Paid
                              </button>
                            )}
                            {isAdmin && o.billingStatus === 'paid' && (
                              <button
                                onClick={() => askOrderRevertBilled(o)}
                                className="inline-flex items-center gap-1 rounded-md bg-white border border-amber-200 text-amber-700 px-2 py-1 text-[10px] font-semibold hover:bg-amber-50 transition"
                              >
                                Revert
                              </button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirm action */}
      <Modal
        open={!!actionTarget}
        onClose={() => !processing && setActionTarget(null)}
        title={actionTarget?.label || 'Confirm'}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-amber-50 grid place-items-center">
            <ShieldAlert className="text-amber-600" size={22} />
          </div>
          <p className="text-sm text-slate-700 text-center">{actionTarget?.description}</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setActionTarget(null)} disabled={processing}>
              Cancel
            </button>
            <button className="btn-primary" onClick={runAction} disabled={processing}>
              {processing ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : 'Confirm'}
            </button>
          </div>
        </div>
      </Modal>

      <SuccessModal open={successOpen} onClose={() => setSuccessOpen(false)} title="Success" message={successMsg} />
    </div>
  );
};

export default UndeliveredOrders;