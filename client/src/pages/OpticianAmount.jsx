import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const OpticianAmount = () => {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.get('/billing/optician/summary')
      .then((r) => setS(r.data))
      .catch((e) => {
        console.error('Summary failed:', e);
        setErr(e.response?.data?.message || 'Failed to load summary');
      });
  }, []);

  if (err) {
    return (
      <div className="card p-6 text-center text-sm text-rose-600">{err}</div>
    );
  }

  const cards = s ? [
    { label: 'Pending',          value: s.pendingCount ?? 0,        cls: 'text-amber-600' },
    { label: 'Draft Bills',      value: s.draftCount ?? 0,          cls: 'text-sky-600' },
    { label: 'Submitted Orders', value: s.submittedOrderCount ?? 0, cls: 'text-indigo-600' },
    { label: 'Paid Orders',      value: s.paidOrderCount ?? 0,      cls: 'text-emerald-600' },
    { label: 'Delivered',        value: s.deliveredCount ?? 0,      cls: 'text-violet-600' },
    { label: 'Pending Total',    value: money(s.pendingTotal),      cls: 'text-slate-900' },
    { label: 'Draft Total',      value: money(s.draftTotal),        cls: 'text-sky-700' },
    { label: 'Submitted Batches', value: s.submittedBatchCount ?? 0, cls: 'text-indigo-700' },
    { label: 'Paid Batches',     value: s.paidBatchCount ?? 0,      cls: 'text-emerald-700' },
    { label: 'Fargo Total',      value: money(s.fargoTotal),        cls: 'text-orange-600' },
    { label: 'Submitted Value',  value: money(s.submittedBatchTotal), cls: 'text-indigo-700' },
    { label: 'Paid Value',       value: money(s.paidBatchTotal),    cls: 'text-emerald-700' },
  ] : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Order Amount</h1>
        <p className="text-xs text-slate-500 mt-0.5">Live figures across pending, draft, submitted, and paid.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {cards.map((c, i) => (
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
    </div>
  );
};

export default OpticianAmount;