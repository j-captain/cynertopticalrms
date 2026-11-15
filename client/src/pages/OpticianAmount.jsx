import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '../lib/api.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const OpticianAmount = () => {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get('/billing/optician/summary').then((r) => setS(r.data)).catch(() => {});
  }, []);

  const cards = s ? [
    { label: 'Pending', value: s.pendingCount, cls: 'text-amber-600' },
    { label: 'Billed', value: s.billedCount, cls: 'text-sky-600' },
    { label: 'Paid', value: s.paidCount, cls: 'text-emerald-600' },
    { label: 'Delivered', value: s.deliveredCount, cls: 'text-violet-600' },
    { label: 'Pending Total', value: money(s.pendingTotal), cls: 'text-slate-900' },
    { label: 'Billed Total', value: money(s.billedTotal), cls: 'text-sky-700' },
  ] : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900">Order Amount</h1>
        <p className="text-xs text-slate-500 mt-0.5">Overview of pending and billed amounts.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="card p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className={`text-lg font-extrabold mt-0.5 ${c.cls}`}>{c.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default OpticianAmount;