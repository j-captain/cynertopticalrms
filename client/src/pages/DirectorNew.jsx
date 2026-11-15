import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import ExportMenu from '../components/ExportMenu.jsx';
import { exportSummaryPdf } from '../lib/pdf.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const DirectorNew = () => {
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get('/billing/director/summary')
      .then((r) => setS(r.data))
      .catch(() => toast.error('Failed to load summary'));
  }, []);

  const cards = s ? [
    { label: 'New Bills', value: s.newOrders, cls: 'text-sky-600' },
    { label: 'Billed', value: s.billed, cls: 'text-amber-600' },
    { label: 'Paid', value: s.paid, cls: 'text-emerald-600' },
    { label: 'Delivered', value: s.delivered, cls: 'text-violet-600' },
    { label: 'Unpaid Total', value: money(s.unpaidTotal), cls: 'text-rose-600' },
    { label: 'Paid Total', value: money(s.paidTotal), cls: 'text-emerald-700' },
  ] : [];

  const exportCsv = () => {
    const header = ['Metric', 'Value'];
    const rows = [
      ['New Bills', s?.newOrders ?? 0],
      ['Billed', s?.billed ?? 0],
      ['Paid', s?.paid ?? 0],
      ['Delivered', s?.delivered ?? 0],
      ['Unpaid Total (KES)', s?.unpaidTotal ?? 0],
      ['Paid Total (KES)', s?.paidTotal ?? 0],
    ];
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `director-summary-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdfSummary = () => {
    const d = s || {};
    exportSummaryPdf({
      title: 'Director Summary',
      subtitle: 'Live billing overview',
      stats: [
        { label: 'New Bills', value: d.newOrders ?? 0 },
        { label: 'Billed', value: d.billed ?? 0 },
        { label: 'Paid', value: d.paid ?? 0 },
        { label: 'Delivered', value: d.delivered ?? 0 },
        { label: 'Unpaid Total', value: money(d.unpaidTotal) },
        { label: 'Paid Total', value: money(d.paidTotal) },
      ],
      grouped: [],
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">Snapshot of orders and payments.</p>
        </div>
        <ExportMenu
          onCsv={exportCsv}
          onPdfSummary={exportPdfSummary}
          onPdfTable={null}
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
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

export default DirectorNew;