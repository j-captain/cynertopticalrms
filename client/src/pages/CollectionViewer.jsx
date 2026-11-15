import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ChevronLeft, ChevronRight, RefreshCw, Search,
  Database as DatabaseIcon, FileJson,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';

const fmtCell = (v) => {
  if (v === null || v === undefined) return '-';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const HUMAN_NAMES = {
  users: 'Users',
  patients: 'Patients',
  orderlogs: 'Order Logs',
  settings: 'Settings',
  auditlogs: 'Audit Logs',
  icd11codes: 'ICD-11 Codes',
  insurances: 'Insurances',
  customrecipients: 'Custom Recipients',
};

const CollectionViewer = () => {
  const { name } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/db/view/${name}`, { params: { page, limit } });
      setData(r.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load collection');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [name, page, limit]);

  // Client-side filter on the loaded page
  const filteredDocs = (data?.docs || []).filter((doc) => {
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return Object.values(doc).some((v) => fmtCell(v).toLowerCase().includes(needle));
  });

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/database')} className="btn-ghost !px-2 !py-1.5">
            <ArrowLeft size={14} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <DatabaseIcon size={18} className="text-sky-600" />
              {HUMAN_NAMES[name] || name}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">
              {name} · {total.toLocaleString()} document(s)
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost !py-1.5 !px-3 !text-xs">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
        <div className="relative md:col-span-6">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-2 !pl-8 !text-xs w-full"
            placeholder="Filter loaded rows…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="md:col-span-3">
          <select
            className="input !py-2 !text-xs w-full"
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          >
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
            <option value={200}>200 per page</option>
            <option value={500}>500 per page</option>
          </select>
        </div>
        <div className="md:col-span-3 flex md:justify-end text-xs text-slate-500 items-center">
          {q && <span>{filteredDocs.length} matching on this page</span>}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-260px)]">
          <table className="min-w-full text-[11px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                {(data?.keys || []).map((k) => (
                  <th
                    key={k}
                    className="px-2 py-2 text-left font-semibold whitespace-nowrap bg-slate-50 border-b border-slate-200"
                  >
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={data?.keys?.length || 1} className="text-center py-10 text-slate-400">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && (data?.docs?.length === 0) && (
                <tr>
                  <td colSpan={data?.keys?.length || 1} className="text-center py-10 text-slate-400">
                    <FileJson className="mx-auto mb-2" size={24} /> No documents.
                  </td>
                </tr>
              )}
              {!loading && data?.docs?.length > 0 && filteredDocs.length === 0 && (
                <tr>
                  <td colSpan={data?.keys?.length || 1} className="text-center py-10 text-slate-400">
                    No rows match "{q}"
                  </td>
                </tr>
              )}
              {filteredDocs.map((doc, i) => (
                <motion.tr
                  key={doc._id || i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.005, 0.1) }}
                  className="border-t border-slate-100 hover:bg-sky-50/40"
                >
                  {(data?.keys || []).map((k) => {
                    const v = doc[k];
                    const str = fmtCell(v);
                    const isId = k === '_id';
                    return (
                      <td
                        key={k}
                        className={`px-2 py-1.5 text-slate-700 whitespace-nowrap max-w-[220px] truncate align-top ${
                          isId ? 'font-mono text-slate-500' : ''
                        }`}
                        title={str}
                      >
                        {str}
                      </td>
                    );
                  })}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 text-xs text-slate-600">
          <span>
            Page {page} of {pages} · showing {filteredDocs.length} of {total.toLocaleString()} document(s)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="btn-ghost !px-2 !py-1 !text-xs disabled:opacity-40"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="btn-ghost !px-2 !py-1 !text-xs disabled:opacity-40"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CollectionViewer;