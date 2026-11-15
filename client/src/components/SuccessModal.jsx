import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';

const DURATION = 4000; // ms

const SuccessModal = ({ open, onClose, title = 'Success', message, duration = DURATION }) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!open) {
      setProgress(100);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (elapsed >= duration) {
        clearInterval(interval);
        onClose?.();
      }
    }, 40);
    return () => clearInterval(interval);
  }, [open, duration, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />

          {/* Card */}
          <motion.div
            initial={{ y: 20, scale: 0.94, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Close icon top-right */}
            <button
              onClick={onClose}
              className="absolute top-2.5 right-2.5 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition z-10"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            {/* Content */}
            <div className="px-6 pt-8 pb-6 text-center">
              {/* Animated check */}
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.05 }}
                className="mx-auto mb-3 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center shadow-lg shadow-emerald-200"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                >
                  <CheckCircle2 className="text-white" size={34} />
                </motion.div>
              </motion.div>

              {/* Rings animation */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0.6 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                className="pointer-events-none absolute top-8 left-1/2 -translate-x-1/2 h-16 w-16 rounded-full border-2 border-emerald-300"
              />

              <motion.h3
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-lg font-extrabold text-slate-900"
              >
                {title}
              </motion.h3>

              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="mt-1 text-sm text-slate-600 leading-relaxed"
              >
                {message}
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                onClick={onClose}
                className="mt-5 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold py-2.5 hover:shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Done
              </motion.button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-slate-100 overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: `${progress}%` }}
                transition={{ ease: 'linear', duration: 0.04 }}
                className="h-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SuccessModal;