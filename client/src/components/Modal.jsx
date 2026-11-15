import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const Modal = ({ open, onClose, title, children, width = 'max-w-lg' }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dialog - capped, scrollable body, sticky header */}
        <motion.div
          className={`relative w-full ${width} bg-white rounded-2xl shadow-soft border border-slate-100 p-0 flex flex-col overflow-visible`}
          style={{ maxHeight: 'calc(100vh - 2rem)' }}
          initial={{ y: 24, scale: 0.96, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 16, scale: 0.97, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        >
          {/* Sticky header */}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
            <h3 className="text-base font-bold text-slate-900 truncate">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition shrink-0"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto px-5 py-4 min-h-0">
            {children}
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default Modal;