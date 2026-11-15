import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const StatusBadge = ({ status }) => {
  const map = {
    billed: { label: 'Billed', cls: 'bg-sky-50 text-sky-700' },
    paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700' },
    delivered: { label: 'Delivered', cls: 'bg-violet-50 text-violet-700' },
  };
  const s = map[status] || { label: status, cls: 'bg-slate-100 text-slate-600' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
};

const OpticianAll = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/billing/optician/all', { params: { q } });
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
  }, [q]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">All Orders</h1>
        <p className="text-xs text-slate-500 mt-0.5">Billed, paid and delivered orders.</p>
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
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Patient</th>
                <th className="px-2 py-2 text-left font-semibold">Sys No.</th>
                <th className="px-2 py-2 text-left font-semibold">Lens</th>
                <th className="px-2 py-2 text-right font-semibold">Total Bill</th>
                <th className="px-2 py-2 text-left font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Loading…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No orders.</td></tr>}
              {rows.map((p) => (
                <motion.tr
                  key={p._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-t border-slate-100 hover:bg-sky-50/40"
                >
                  <td className="px-2 py-1.5 text-slate-400 tabular-nums">{p.index}</td>
                  <td className="px-2 py-1.5 font-semibold text-slate-800 whitespace-nowrap max-w-[140px] truncate">
                    {p.patientName}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.systemNumber}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[100px] truncate">{p.lensType}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{money(p.billing?.total)}</td>
                  <td className="px-2 py-1.5"><StatusBadge status={p.billingStatus} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OpticianAll;