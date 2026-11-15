import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, ShieldAlert } from 'lucide-react';

const Forbidden = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="card p-8 text-center space-y-5">
          <div className="mx-auto h-16 w-16 rounded-full bg-amber-50 grid place-items-center ring-4 ring-amber-100">
            <ShieldAlert className="text-amber-600" size={28} />
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-bold">
              Error 403
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
              Access denied
            </h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              You don't have permission to view this page. Contact an administrator
              if you believe this is a mistake.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <button onClick={() => navigate(-1)} className="btn-ghost">
              <ArrowLeft size={14} /> Go Back
            </button>
            <button onClick={() => navigate('/')} className="btn-primary">
              <Home size={14} /> Home
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Forbidden;