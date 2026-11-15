import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api.js';

const MAX_VISIBLE = 5;

const DiagnosisPicker = ({ value, onChange, required }) => {
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null); // 'code' | 'desc' | null
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);

  // Load the full list once - it's small (< a few hundred)
  useEffect(() => {
    let alive = true;
    api
      .get('/icd11')
      .then((r) => {
        if (alive) setCodes(r.data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(null);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Compute filtered list based on the current query + which field is open
  const filtered = useMemo(() => {
    const term = (query || '').trim().toLowerCase();
    let list;
    if (!term) {
      list = codes.slice(0, MAX_VISIBLE);
    } else if (open === 'code') {
      list = codes.filter(
        (c) =>
          c.code.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term)
      );
    } else if (open === 'desc') {
      list = codes.filter((c) => c.description.toLowerCase().includes(term));
    } else {
      list = [];
    }
    return list.slice(0, MAX_VISIBLE);
  }, [codes, query, open]);

  useEffect(() => setActiveIndex(0), [query, open]);

  const pick = (c) => {
    onChange({ code: c.code, description: c.description });
    setOpen(null);
    setQuery('');
  };

  const handleOpenCode = () => {
    setOpen('code');
    setQuery(value.code || '');
  };
  const handleOpenDesc = () => {
    setOpen('desc');
    setQuery(value.description || '');
  };

  const handleCodeChange = (v) => {
    const up = v.toUpperCase();
    onChange({ code: up, description: value.description || '' });
    setOpen('code');
    setQuery(up);
  };

  const handleDescChange = (v) => {
    onChange({ code: value.code || '', description: v });
    setOpen('desc');
    setQuery(v);
  };

  const handleKey = (e) => {
    if (open == null) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (filtered[activeIndex]) {
        e.preventDefault();
        pick(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(null);
      setQuery('');
    }
  };

  const clearCode = () => {
    onChange({ code: '', description: value.description || '' });
    setOpen(null);
    setQuery('');
  };
  const clearDesc = () => {
    onChange({ code: value.code || '', description: '' });
    setOpen(null);
    setQuery('');
  };

  // Reusable dropdown panel
  const Dropdown = () => (
    <AnimatePresence>
      {open && filtered.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
        >
          <div className="max-h-60 overflow-y-auto">
            {filtered.map((c, idx) => (
              <button
                type="button"
                key={c._id}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => pick(c)}
                className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition ${
                  idx === activeIndex ? 'bg-sky-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className="shrink-0 mt-0.5 inline-flex items-center rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-[10px] font-bold font-mono px-1.5 py-0.5">
                  {c.code}
                </span>
                <span className="flex-1 text-xs text-slate-700 leading-snug">{c.description}</span>
              </button>
            ))}
          </div>
          <div className="px-3 py-1.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between bg-slate-50/50">
            <span>{filtered.length} shown · ↑↓ to navigate · Enter to select</span>
            {query && <span className="text-slate-500">matches for "{query}"</span>}
          </div>
        </motion.div>
      )}
      {open && !loading && filtered.length === 0 && query && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.12 }}
          className="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-4 text-center text-xs text-slate-500"
        >
          No matching codes. You can still enter a free-form code + description.
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={wrapperRef} className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2 flex-1">
      {/* Code input */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          className="input !py-2 !pl-7 !pr-7 !text-xs font-mono uppercase"
          placeholder="ICD-11 code"
          value={value.code || ''}
          onChange={(e) => handleCodeChange(e.target.value)}
          onFocus={handleOpenCode}
          onKeyDown={handleKey}
          required={required}
          autoComplete="off"
        />
        {value.code && (
          <button
            type="button"
            onClick={clearCode}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            tabIndex={-1}
          >
            <X size={11} />
          </button>
        )}
        {open === 'code' && <Dropdown />}
      </div>

      {/* Description input */}
      <div className="relative">
        <input
          className="input !py-2 !pr-7 !text-xs"
          placeholder={loading ? 'Loading…' : 'Diagnosis description'}
          value={value.description || ''}
          onChange={(e) => handleDescChange(e.target.value)}
          onFocus={handleOpenDesc}
          onKeyDown={handleKey}
          required={required && !value.code}
          autoComplete="off"
        />
        {value.description && (
          <button
            type="button"
            onClick={clearDesc}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            tabIndex={-1}
          >
            <X size={11} />
          </button>
        )}
        {open === 'desc' && <Dropdown />}
      </div>
    </div>
  );
};

export default DiagnosisPicker;