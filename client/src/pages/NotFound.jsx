import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, Compass } from 'lucide-react';

const NotFound = () => {
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
          <div className="mx-auto h-16 w-16 rounded-full bg-sky-50 grid place-items-center ring-4 ring-sky-100">
            <Compass className="text-sky-600" size={28} />
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-400 font-bold">
              Error 404
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">
              Page not found
            </h1>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">
              The page you're looking for doesn't exist, was moved, or the URL might be mistyped.
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

          <p className="text-[11px] text-slate-400">
            If you believe this is a mistake, please contact support.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFound;