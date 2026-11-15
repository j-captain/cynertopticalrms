import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

const StyleSelect = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  icon: Icon,
  disabled,
  openUp = true,
  // Colour options for the dropdown panel
  topColor = '#ef4444',       // red
  rightColor = '#22c55e',     // green
  bottomColor = '#c0c0c0',    // silver
  leftColor = '#f97316',      // orange
  bgColor = '#e0f7fa',        // aqua
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);

  const items = useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((o) =>
        typeof o === 'string' ? { value: o, label: o } : o
      ),
    [options]
  );

  const selected = items.find((i) => i.value === value);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    if (!open) return;
    const idx = items.findIndex((i) => i.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }, [open, value, items]);

  const pick = (it) => {
    onChange(it.value);
    setOpen(false);
  };

  const toggleOpen = () => {
    if (disabled) return;
    setOpen((o) => !o);
  };

  const onKey = (e) => {
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (items[activeIndex]) {
        e.preventDefault();
        pick(items[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`input !text-xs !py-2 flex items-center justify-between gap-2 w-full text-left ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={14} className="text-slate-400 shrink-0" />}
          <span className={`truncate ${selected ? 'text-slate-800' : 'text-slate-400'}`}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 4 : -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            style={{
              borderTopColor: topColor,
              borderRightColor: rightColor,
              borderBottomColor: bottomColor,
              borderLeftColor: leftColor,
              backgroundColor: bgColor,
            }}
            className={`absolute z-[9999] ${
              openUp ? 'bottom-full mb-1' : 'top-full mt-1'
            } left-0 right-0 rounded-xl border-2 shadow-xl overflow-hidden max-h-64 overflow-y-auto`}
          >
            {items.length === 0 && (
              <li className="px-3 py-2 text-xs text-slate-500 italic">
                No options
              </li>
            )}
            {items.map((it, idx) => {
              const isSel = it.value === value;
              const isPlaceholder = it.value === '';
              return (
                <li
                  role="option"
                  aria-selected={isSel}
                  key={it.value || `empty-${idx}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => {
                    if (isPlaceholder) return;
                    pick(it);
                  }}
                    className={`px-3 py-2 text-xs flex items-center justify-between gap-2 transition ${
                    isPlaceholder
                        ? 'text-slate-500 italic cursor-default'
                        : idx === activeIndex
                        ? 'bg-green-200 text-green-900 cursor-pointer'
                        : 'text-slate-700 hover:bg-green-200 hover:text-green-900 cursor-pointer'
                    }`}
                >
                  <span className="truncate">{it.label}</span>
                  {isSel && !isPlaceholder && (
                    <Check size={13} className="text-sky-700 shrink-0" />
                  )}
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StyleSelect;