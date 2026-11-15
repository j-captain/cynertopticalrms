import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileText, FileSpreadsheet, ChevronDown, BarChart3 } from 'lucide-react';

/**
 * Props:
 *  onCsv       - () => void
 *  onPdfSummary- () => void
 *  onPdfTable  - () => void
 */
const ExportMenu = ({ onCsv, onPdfSummary, onPdfTable }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const Item = ({ icon: Icon, label, desc, onClick }) => (
    <button
      type="button"
      onClick={() => {
        setOpen(false);
        onClick();
      }}
      className="w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-slate-50 transition"
    >
      <Icon size={14} className="text-sky-600 mt-0.5 shrink-0" />
      <span>
        <span className="block text-xs font-semibold text-slate-800">{label}</span>
        <span className="block text-[10px] text-slate-500">{desc}</span>
      </span>
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="btn-ghost !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
      >
        <Download size={13} /> Export <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-1 w-64 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden z-40"
          >
            <Item icon={FileSpreadsheet} label="CSV" desc="Spreadsheet - Excel, Sheets" onClick={onCsv} />
            <Item icon={BarChart3} label="PDF - Summary" desc="KPIs and totals only" onClick={onPdfSummary} />
            <Item icon={FileText} label="PDF - Table" desc="Full data as a table" onClick={onPdfTable} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExportMenu;