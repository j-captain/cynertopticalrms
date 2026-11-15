import { motion } from 'framer-motion';

const StatCard = ({ icon: Icon, label, value, hint, delay = 0, tone = 'sky' }) => {
  const tones = {
    sky: 'from-sky-500 to-indigo-500',
    emerald: 'from-emerald-500 to-teal-500',
    amber: 'from-amber-500 to-orange-500',
    rose: 'from-rose-500 to-pink-500',
    slate: 'from-slate-700 to-slate-900',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="card p-5 hover:shadow-lg transition-shadow duration-300"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="text-2xl font-extrabold text-slate-900 mt-1">{value}</p>
          {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        </div>
        <div className={`rounded-xl p-2.5 bg-gradient-to-br ${tones[tone]} text-white shadow-md`}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;