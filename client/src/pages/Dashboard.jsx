import { useEffect, useState } from 'react';
import {
  Users, ShoppingBag, Clock, CheckCircle2, Package, TrendingUp,
  Layers, XCircle, Wallet, CircleDollarSign, FileText, Glasses,
  Frame, Briefcase, Landmark, Banknote, Mail, MailX, AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../lib/api.js';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;
const num = (n) => Number(n || 0).toLocaleString('en-KE');

const TONES = {
  sky:     { bg: 'bg-sky-50',     text: 'text-sky-600',     ring: 'ring-sky-100' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   ring: 'ring-amber-100' },
  rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    ring: 'ring-rose-100' },
  indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  ring: 'ring-indigo-100' },
  violet:  { bg: 'bg-violet-50',  text: 'text-violet-600',  ring: 'ring-violet-100' },
  slate:   { bg: 'bg-slate-50',   text: 'text-slate-700',   ring: 'ring-slate-100' },
};

const Card = ({ icon: Icon, label, value, hint, tone = 'sky', delay = 0 }) => {
  const t = TONES[tone] || TONES.sky;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-4 flex flex-col justify-between h-32"
    >
      <div className="flex items-start justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <span className={`h-8 w-8 grid place-items-center rounded-lg ${t.bg} ${t.text} ring-1 ${t.ring}`}>
          <Icon size={14} />
        </span>
      </div>
      <div>
        <p className={`text-xl font-extrabold ${t.text}`}>{value}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5 truncate" title={hint}>{hint}</p>}
      </div>
    </motion.div>
  );
};

const SectionTitle = ({ children, sub }) => (
  <div className="mt-3 mb-1">
    <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{children}</h2>
    {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get('/reports/dashboard');
      setStats(r.data);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-40 bg-slate-100 rounded animate-pulse" />
          <div className="h-4 w-64 bg-slate-100 rounded mt-2 animate-pulse" />
        </div>
        {Array.from({ length: 5 }).map((_, r) => (
          <div key={r} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((__, c) => (
              <div key={c} className="card p-4 h-32 animate-pulse bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 flex items-start gap-3 border border-rose-100 bg-rose-50">
        <AlertTriangle className="text-rose-600 mt-0.5" size={18} />
        <div className="flex-1">
          <p className="font-semibold text-rose-700 text-sm">Could not load dashboard</p>
          <p className="text-xs text-rose-600 mt-0.5">{error}</p>
        </div>
        <button onClick={load} className="btn-ghost !text-xs">Retry</button>
      </div>
    );
  }

  const s = stats || {};
  const pa = s.preAuth || { count: 0, lenses: 0, frames: 0, total: 0 };
  const bl = s.billed || { lenses: 0, frames: 0, fitting: 0, cases: 0, total: 0, paidTotal: 0, outstandingTotal: 0 };
  const bt = s.batches || { fargoTotal: 0, ordersTotal: 0, grandTotal: 0 };
  const ca = s.cash || { orders: {}, batches: {} };
  const cashOrders = ca.orders || {};
  const cashBatches = ca.batches || {};
  const ins = s.insurance || { count: 0, revenue: 0 };

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Comprehensive overview of patients, orders, pre-auths, billing, batches and revenue.
        </p>
      </motion.div>

      {/* ── Patients & Orders ── */}
      <SectionTitle>Patients &amp; Orders</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card icon={Users}        label="Total Patients"   value={num(s.totalPatients)}  tone="sky"     delay={0.02} />
        <Card icon={ShoppingBag}  label="Orders Placed"    value={num(s.ordered)}        tone="emerald" delay={0.04} />
        <Card icon={Clock}        label="Pending Orders"   value={num(s.pending)}        tone="amber"   delay={0.06} />
        <Card icon={Package}      label="Delivered"        value={num(s.delivered)}      tone="violet"  delay={0.08} />
        <Card icon={CheckCircle2} label="Handed to Client" value={num(s.handed)}         tone="slate"   delay={0.10} />
      </div>

      {/* ── Billing status ── */}
      <SectionTitle>Billing Status</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card icon={FileText}  label="Billed (Draft)"        value={num(s.billedCount)}      tone="sky"     delay={0.02} />
        <Card icon={Layers}    label="Submitted to Director" value={num(s.submittedCount)}   tone="indigo"  delay={0.04} />
        <Card icon={CheckCircle2} label="Paid"               value={num(s.paidCount)}        tone="emerald" delay={0.06} />
        <Card icon={Layers}    label="Live Batches"          value={num(s.liveBatchesCount)} tone="violet"  delay={0.08} />
        <Card icon={XCircle}   label="Cancelled Batches"     value={num(s.cancelledBatches)} tone="rose"    delay={0.10} />
      </div>

      {/* ── Pre-auth (estimate from SHA) ── */}
      <SectionTitle sub="Amounts requested from SHA before the order is sent">
        Pre-Auth (SHA Estimate)
      </SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card icon={FileText} label="Pre-Auths Submitted" value={num(pa.count)}   tone="indigo"  delay={0.02} />
        <Card icon={Glasses}  label="Pre-Auth Lenses"     value={money(pa.lenses)} tone="sky"    delay={0.04} />
        <Card icon={Frame}    label="Pre-Auth Frames"     value={money(pa.frames)} tone="emerald" delay={0.06} />
        <Card icon={TrendingUp} label="Pre-Auth Total"    value={money(pa.total)}  tone="violet" delay={0.08} />
      </div>

      {/* ── Billed (actual from optician) ── */}
      <SectionTitle sub="Actual amounts entered by the optician when billing">
        Billed Amounts
      </SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card icon={Glasses}  label="Billed Lenses"  value={money(bl.lenses)}  tone="sky"     delay={0.02} />
        <Card icon={Frame}    label="Billed Frames"  value={money(bl.frames)}  tone="emerald" delay={0.04} />
        <Card icon={Briefcase} label="Billed Fitting" value={money(bl.fitting)} tone="violet"  delay={0.06} />
        <Card icon={Package}  label="Billed Cases"   value={money(bl.cases)}   tone="slate"   delay={0.08} />
        <Card icon={TrendingUp} label="Billed Total" value={money(bl.total)}   tone="indigo"  delay={0.10} />
      </div>

      {/* ── Revenue ── */}
      <SectionTitle>Revenue</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card icon={TrendingUp}       label="Total Billed"    value={money(bl.total)}             tone="emerald" delay={0.02} />
        <Card icon={CircleDollarSign} label="Paid Revenue"    value={money(bl.paidTotal)}         tone="sky"     delay={0.04} />
        <Card icon={Wallet}           label="Outstanding"     value={money(bl.outstandingTotal)}  tone="amber"   delay={0.06} />
        <Card icon={Banknote}         label="Fargo Total"     value={money(bt.fargoTotal)}        tone="rose"    delay={0.08} />
        <Card icon={Landmark}         label="Director Grand"  value={money(bt.grandTotal)}        tone="indigo"  delay={0.10} />
      </div>

      {/* ── Cash vs Insurance ── */}
      <SectionTitle sub="Cash = any scheme other than Insurance">
        Cash vs Insurance
      </SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card
          icon={Banknote}
          label="Cash Orders"
          value={num(cashOrders.count)}
          hint={`Revenue: ${money(cashOrders.revenue)}`}
          tone="emerald"
          delay={0.02}
        />
        <Card
          icon={Banknote}
          label="Cash Batches"
          value={num(cashBatches.count)}
          hint={`Grand: ${money(cashBatches.grandTotal)}`}
          tone="emerald"
          delay={0.04}
        />
        <Card
          icon={Landmark}
          label="Insurance Orders"
          value={num(ins.count)}
          hint={`Revenue: ${money(ins.revenue)}`}
          tone="indigo"
          delay={0.06}
        />
        <Card icon={Glasses} label="Cash Lenses"  value={money(cashOrders.lenses)} tone="sky"    delay={0.08} />
        <Card icon={Frame}   label="Cash Frames"  value={money(cashOrders.frames)} tone="violet" delay={0.10} />
      </div>

      {/* ── Cash batch breakdown ── */}
      <SectionTitle sub="Only batches where every order is cash">
        Cash Batches Breakdown
      </SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <Card icon={Layers}    label="Cash Batch Orders Total" value={money(cashBatches.ordersTotal)} tone="sky"    delay={0.02} />
        <Card icon={Banknote}  label="Cash Batch Fargo"        value={money(cashBatches.fargo)}       tone="rose"   delay={0.04} />
        <Card icon={Landmark}  label="Cash Batch Grand Total"  value={money(cashBatches.grandTotal)}  tone="emerald" delay={0.06} />
        <Card icon={Briefcase} label="Cash Fitting"            value={money(cashOrders.fitting)}      tone="violet" delay={0.08} />
      </div>

      {/* ── Emails ── */}
      <SectionTitle>Email Activity</SectionTitle>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <Card icon={Mail}  label="Emails Sent"   value={num(s.sentEmails)}   tone="sky"    delay={0.02} />
        <Card icon={MailX} label="Emails Failed" value={num(s.failedEmails)} tone="rose"   delay={0.04} />
      </div>

      {/* ── Activity chart + delivery panel ── */}
      <div className="grid lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-5 lg:col-span-2"
        >
          <h2 className="text-sm font-bold text-slate-900 mb-1">Order Emails - Last 7 Days</h2>
          <p className="text-xs text-slate-500 mb-4">Number of order emails submitted per day.</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.activity || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #eef2f7', fontSize: 12 }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24 }}
          className="card p-5"
        >
          <h2 className="text-sm font-bold text-slate-900 mb-3">Email Delivery</h2>
          <div className="space-y-3">
            <div className="rounded-xl bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700 font-semibold">Sent</p>
              <p className="text-2xl font-extrabold text-emerald-700">{num(s.sentEmails)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3">
              <p className="text-xs text-rose-700 font-semibold">Failed</p>
              <p className="text-2xl font-extrabold text-rose-700">{num(s.failedEmails)}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;