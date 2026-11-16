import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronDown, ChevronRight, Wallet, CheckCircle2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';

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

const OpticianSubmitted = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/billing/batches', { params: { q, status: 'all' } });
      setBatches(r.data);
    } catch {
      toast.error('Failed to load submitted batches');
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Submitted Orders</h1>
        <p className="text-xs text-slate-500 mt-0.5">Every batch you've pushed to the director.</p>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          className="input !py-2 !pl-8 !text-xs"
          placeholder="Search batch no., patient, system no…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-2 w-8"></th>
                <th className="px-2 py-2 text-left font-semibold">Batch</th>
                <th className="px-2 py-2 text-left font-semibold">Submitted</th>
                <th className="px-2 py-2 text-right font-semibold">Orders</th>
                <th className="px-2 py-2 text-right font-semibold">Fargo</th>
                <th className="px-2 py-2 text-right font-semibold">Grand Total</th>
                <th className="px-2 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} className="text-center py-8 text-slate-400">Loading…</td></tr>}
              {!loading && batches.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">No submitted batches yet.</td></tr>}
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
                      <td className="px-2 py-1.5 text-right tabular-nums">{b.orderIds?.length || 0}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{money(b.fargoAmount)}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-sky-600 tabular-nums">{money(b.grandTotal)}</td>
                      <td className="px-2 py-1.5"><StatusPill status={b.status} /></td>
                    </motion.tr>
                    <AnimatePresence>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="bg-slate-50/50 px-2 py-2">
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
    </div>
  );
};

export default OpticianSubmitted;