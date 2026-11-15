import { motion } from 'framer-motion';
import { Mail, FileText, Info } from 'lucide-react';
import Modal from './Modal.jsx';

const EmailModeModal = ({ open, onClose, onSelect }) => {
  return (
    <Modal open={open} onClose={onClose} title="Choose Email Format" width="max-w-md">
      <div className="space-y-3">
        <p className="text-xs text-slate-500">
          Pick how much detail the recipient receives. Both formats include{' '}
          <b>lens amount, frame amount and total</b>.
        </p>

        <motion.button
          type="button"
          onClick={() => onSelect('full')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
          className="w-full text-left rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/40 p-3 transition flex items-start gap-3"
        >
          <div className="shrink-0 rounded-lg bg-sky-50 p-2">
            <FileText size={18} className="text-sky-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Full Summary</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              System number, scheme, insurance, pre-auth date, prescription, diagnoses, complaint, and all amounts.
            </p>
          </div>
        </motion.button>

        <motion.button
          type="button"
          onClick={() => onSelect('mini')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          whileHover={{ scale: 1.01 }}
          className="w-full text-left rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40 p-3 transition flex items-start gap-3"
        >
          <div className="shrink-0 rounded-lg bg-indigo-50 p-2">
            <Mail size={18} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900">Mini Summary</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Patient name, lens type, prescription, diagnoses, submission date, and all amounts.
              <span className="block mt-1 text-amber-700">
                <Info size={10} className="inline -mt-0.5 mr-1" />
                Excludes: system number, scheme, insurance, pre-auth date, complaint.
              </span>
            </p>
          </div>
        </motion.button>

        <div className="flex justify-end pt-1">
          <button className="btn-ghost !py-2 !px-4 !text-xs" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default EmailModeModal;