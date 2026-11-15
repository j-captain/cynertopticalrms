import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ShieldCheck, Building2 } from 'lucide-react';
import api from '../lib/api.js';
import StyleSelect from './StyleSelect.jsx';

const SCHEMES = ['Self-Sponsored (Cash)', 'Insurance'];

/**
 * Renders Scheme (+ Insurance when applicable).
 * Each field fills its own container - layout is controlled by the parent.
 *
 * Props:
 *  scheme      - current scheme string
 *  insurance   - current insurance string (ignored when scheme === Self-Sponsored)
 *  onChange    - ({ scheme, insurance }) => void
 *  disabled    - optional
 */
const InsuranceSelect = ({ scheme, insurance, onChange, disabled }) => {
  const [insurers, setInsurers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .get('/insurance', { params: { active: 'true' } })
      .then((r) => { if (alive) setInsurers(r.data); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const insurerOptions = useMemo(
    () => insurers.map((i) => ({ value: i.name, label: i.name })),
    [insurers]
  );

  const handleScheme = (s) => {
    if (s === 'Insurance') {
      onChange({ scheme: s, insurance: insurance || '' });
    } else {
      onChange({ scheme: s, insurance: '' });
    }
  };

  return (
    <>
      <div className="w-full">
        <label className="label">Scheme <span className="text-rose-500">*</span></label>
        <StyleSelect
          value={scheme}
          onChange={handleScheme}
          options={SCHEMES}
          placeholder="Select scheme…"
          icon={Wallet}
          disabled={disabled}
        />
      </div>

      <AnimatePresence initial={false}>
        {scheme === 'Insurance' && (
          <motion.div
            key="insurance-field"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.18 }}
            className="w-full"
          >
            <label className="label">
              Insurance <span className="text-rose-500">*</span>
            </label>
            <StyleSelect
              value={insurance}
              onChange={(v) => onChange({ scheme, insurance: v })}
              options={
                loading
                  ? [{ value: '', label: 'Loading…' }]
                  : insurerOptions.length === 0
                  ? [{ value: '', label: 'No insurers configured - ask an admin' }]
                  : insurerOptions
              }
              placeholder="Select insurance…"
              icon={ShieldCheck}
              disabled={disabled || loading || insurerOptions.length === 0}
            />
            {insurerOptions.length === 0 && !loading && (
              <p className="mt-1 text-[11px] text-amber-600 flex items-center gap-1">
                <Building2 size={11} /> Add insurers in the Insurance tab (sidebar).
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default InsuranceSelect;