import { useEffect, useState } from 'react';
import { Users, ShoppingBag, Clock, CheckCircle2, Package, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../lib/api.js';
import StatCard from '../components/StatCard.jsx';

const money = (n) => `KES ${Number(n || 0).toLocaleString('en-KE')}`;

const Dashboard = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get('/reports/dashboard').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="grid md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card p-5 h-28 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Overview of records, orders and activity.</p>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Patients" value={stats.totalPatients} delay={0.02} />
        <StatCard icon={ShoppingBag} label="Orders Placed" value={stats.ordered} delay={0.05} tone="emerald" />
        <StatCard icon={Clock} label="Pending Orders" value={stats.pending} delay={0.08} tone="amber" />
        <StatCard icon={Package} label="Delivered" value={stats.delivered} delay={0.11} tone="sky" />
        <StatCard icon={CheckCircle2} label="Handed to Client" value={stats.handed} delay={0.14} tone="slate" />
        <StatCard
          icon={TrendingUp}
          label="Total Revenue"
          value={money(stats.totalRevenue)}
          hint={`Ordered: ${money(stats.orderedRevenue)}`}
          delay={0.17}
          tone="rose"
        />
      </div>

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
              <BarChart data={stats.activity}>
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
              <p className="text-2xl font-extrabold text-emerald-700">{stats.sentEmails}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3">
              <p className="text-xs text-rose-700 font-semibold">Failed</p>
              <p className="text-2xl font-extrabold text-rose-700">{stats.failedEmails}</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;