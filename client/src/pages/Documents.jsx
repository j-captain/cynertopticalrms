import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search, FileText, Stethoscope, Eye, Download, Upload, Trash2,
  RefreshCw, AlertCircle, CheckCircle2, Building2, Banknote,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import { fmtDate } from '../lib/date.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const fmtSize = (n) => {
  if (!n) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const KIND_META = {
  prescription: { label: 'Optical Prescription', icon: FileText },
  diagnostic: { label: 'Optical Diagnostic Form', icon: Stethoscope },
};

const Documents = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState({ rows: [], summary: null });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  // Uploading state per doc
  const [uploading, setUploading] = useState({});
  const fileRefs = useRef({});

  // Reupload confirmation state
  const [reuploadCtx, setReuploadCtx] = useState(null); // { patientId, kind, patientName, currentFile }
  const [reuploadWorking, setReuploadWorking] = useState(false);

  // Delete confirmation state
  const [deleteCtx, setDeleteCtx] = useState(null);     // { patientId, kind, patientName, fileName, size }
  const [deleteWorking, setDeleteWorking] = useState(false);

  // Success
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/documents', { params: { q } });
      setData(r.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const getRef = (patientId, kind) => {
    const key = `${patientId}:${kind}`;
    if (!fileRefs.current[key]) fileRefs.current[key] = { current: null };
    return fileRefs.current[key];
  };

  const viewDoc = async (patientId, kind) => {
    try {
      const res = await api.get(`/patients/${patientId}/documents/${kind}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not open file');
    }
  };

  const downloadDoc = async (patientId, kind, originalName) => {
    try {
      const res = await api.get(`/patients/${patientId}/documents/${kind}`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalName || `${kind}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Download failed');
    }
  };

  const uploadDoc = async (patientId, kind, file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB');
      return;
    }

    const key = `${patientId}:${kind}`;
    setUploading((u) => ({ ...u, [key]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(
        `/patients/${patientId}/documents/upload?kind=${kind}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      load();
      setSuccessMsg(
        `${kind === 'prescription' ? 'Prescription' : 'Diagnostic form'} uploaded successfully.`
      );
      setSuccessOpen(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [key]: false }));
    }
  };

  const openReuploadConfirm = (patientId, kind, patientName, currentFile) => {
    setReuploadCtx({ patientId, kind, patientName, currentFile });
  };

  const proceedReupload = () => {
    setReuploadWorking(true);
    const ctx = reuploadCtx;
    setReuploadCtx(null);
    setReuploadWorking(false);
    if (!ctx) return;
    setTimeout(() => {
      getRef(ctx.patientId, ctx.kind).current?.click();
    }, 50);
  };

  const openDeleteConfirm = (patientId, kind, patientName, fileName, size) => {
    setDeleteCtx({ patientId, kind, patientName, fileName, size });
  };

  const runDelete = async () => {
    if (!deleteCtx) return;
    setDeleteWorking(true);
    try {
      await api.delete(`/patients/${deleteCtx.patientId}/documents/${deleteCtx.kind}`);
      const label = deleteCtx.kind === 'prescription' ? 'Prescription' : 'Diagnostic form';
      const name = deleteCtx.patientName;
      setDeleteCtx(null);
      load();
      setSuccessMsg(`${label} deleted successfully for ${name}.`);
      setSuccessOpen(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteWorking(false);
    }
  };

  const cards = useMemo(() => data.summary ? [
    { label: 'Patients', value: data.summary.totalPatients },
    { label: 'Total Files', value: data.summary.totalDocs },
    { label: 'Prescriptions', value: data.summary.prescriptions },
    { label: 'Diagnostic Forms', value: data.summary.diagnostics },
  ] : [], [data.summary]);

  const kindLabel = (kind) =>
    kind === 'prescription' ? 'Optical Prescription' : 'Optical Diagnostic Form';

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileText size={18} className="text-sky-600" /> Documentation Library
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Every uploaded prescription and diagnostic form, per patient.
            </p>
          </div>
          <button onClick={load} className="btn-ghost !py-1.5 !px-3 !text-xs">
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="card p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{c.label}</p>
              <p className="text-lg font-extrabold text-slate-900 mt-0.5">{c.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="input !py-2 !pl-8 !text-xs"
            placeholder="Search by patient name or system no…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        {/* Empty / loading */}
        {loading && (
          <div className="card p-10 text-center text-slate-400 text-sm">Loading…</div>
        )}
        {!loading && data.rows.length === 0 && (
          <div className="card p-10 text-center text-slate-400 text-sm">
            <FileText size={28} className="mx-auto mb-2" />
            No documents uploaded yet.
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {!loading && data.rows.map((p, i) => (
            <motion.div
              key={p._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.2) }}
              className="card p-3 flex flex-col"
            >
              {/* Patient header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-slate-900 truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{p.systemNumber}</p>
                </div>
                <span className={`badge shrink-0 ${p.scheme === 'Insurance' ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {p.scheme === 'Insurance' ? (
                    <><Building2 size={9} /> Insurance</>
                  ) : (
                    <><Banknote size={9} /> Cash</>
                  )}
                </span>
              </div>

              {/* Insurance line */}
              {p.scheme === 'Insurance' && p.insurance && (
                <p className="text-[10px] text-slate-500 -mt-1 mb-2 truncate" title={p.insurance}>
                  {p.insurance}
                </p>
              )}

              {/* Doc slots */}
              <div className="space-y-2 flex-1">
                {(['prescription', 'diagnostic']).map((kind) => {
                  const meta = KIND_META[kind];
                  const Icon = meta.icon;
                  const doc = p.documents.find((d) => d.kind === kind);
                  const key = `${p._id}:${kind}`;
                  const busy = uploading[key];
                  const ref = getRef(p._id, kind);

                  return (
                    <div
                      key={kind}
                      className={`rounded-lg border p-2 ${
                        doc ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`rounded-md p-1.5 shrink-0 ${doc ? 'bg-emerald-100' : 'bg-slate-200'}`}>
                          <Icon size={12} className={doc ? 'text-emerald-700' : 'text-slate-500'} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold text-slate-800 truncate">{meta.label}</p>
                          {doc ? (
                            <p className="text-[10px] text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 size={9} />
                              {fmtSize(doc.size)} · {fmtDate(doc.uploadedAt)}
                            </p>
                          ) : (
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">
                              <AlertCircle size={9} /> Not uploaded
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 mt-2 justify-end">
                        <input
                          ref={ref}
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            uploadDoc(p._id, kind, f);
                            e.target.value = '';
                          }}
                        />

                        {doc ? (
                          <>
                            <button
                              type="button"
                              onClick={() => viewDoc(p._id, kind)}
                              className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-700 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 transition"
                              title="View"
                            >
                              <Eye size={10} /> View
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadDoc(p._id, kind, doc.originalName)}
                              className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-700 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 transition"
                              title="Download"
                            >
                              <Download size={10} /> Save
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    openReuploadConfirm(p._id, kind, p.name, doc.originalName)
                                  }
                                  className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-100 text-sky-700 px-2 py-1 text-[10px] font-semibold hover:bg-sky-100 transition disabled:opacity-50"
                                  title="Reupload"
                                >
                                  {busy ? (
                                    <span className="h-2.5 w-2.5 rounded-full border-2 border-sky-300 border-t-sky-600 animate-spin" />
                                  ) : (
                                    <Upload size={10} />
                                  )}
                                  Re-upload
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDeleteConfirm(
                                      p._id,
                                      kind,
                                      p.name,
                                      doc.originalName,
                                      doc.size
                                    )
                                  }
                                  className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-100 text-rose-700 px-2 py-1 text-[10px] font-semibold hover:bg-rose-100 transition"
                                  title="Delete"
                                >
                                  <Trash2 size={10} /> Delete
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          isAdmin && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => ref.current?.click()}
                              className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-2.5 py-1 text-[10px] font-semibold hover:shadow-md hover:-translate-y-0.5 transition disabled:opacity-50"
                            >
                              {busy ? (
                                <span className="h-2.5 w-2.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                              ) : (
                                <Upload size={10} />
                              )}
                              Upload PDF
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Reupload confirmation */}
      <Modal
        open={!!reuploadCtx}
        onClose={() => !reuploadWorking && setReuploadCtx(null)}
        title="Re-upload Document"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <Upload className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Re-upload the <span className="font-semibold">{kindLabel(reuploadCtx?.kind)}</span> for{' '}
              <span className="font-semibold">{reuploadCtx?.patientName}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              The existing file will be replaced. This cannot be undone once the new file is uploaded.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Patient</span>
              <span className="font-semibold text-slate-800">{reuploadCtx?.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span>Document</span>
              <span className="font-semibold text-slate-800">{kindLabel(reuploadCtx?.kind)}</span>
            </div>
            <div className="flex justify-between">
              <span>Current file</span>
              <span className="font-mono text-slate-700 truncate ml-2">
                {reuploadCtx?.currentFile || '-'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="btn-ghost"
              onClick={() => setReuploadCtx(null)}
              disabled={reuploadWorking}
            >
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={proceedReupload}
              disabled={reuploadWorking}
            >
              <Upload size={14} /> Choose File
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteCtx}
        onClose={() => !deleteWorking && setDeleteCtx(null)}
        title="Remove Document"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
            <AlertTriangle className="text-rose-500" size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Delete the <span className="font-semibold">{kindLabel(deleteCtx?.kind)}</span> for{' '}
              <span className="font-semibold">{deleteCtx?.patientName}</span>?
            </p>
            <p className="text-xs text-rose-600 font-semibold mt-1">
              This cannot be undone.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Patient</span>
              <span className="font-semibold text-slate-800">{deleteCtx?.patientName}</span>
            </div>
            <div className="flex justify-between">
              <span>Document</span>
              <span className="font-semibold text-slate-800">{kindLabel(deleteCtx?.kind)}</span>
            </div>
            <div className="flex justify-between">
              <span>File</span>
              <span className="font-mono text-slate-700 truncate ml-2">
                {deleteCtx?.fileName || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Size</span>
              <span className="font-semibold text-slate-800">{fmtSize(deleteCtx?.size)}</span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="btn-ghost"
              onClick={() => setDeleteCtx(null)}
              disabled={deleteWorking}
            >
              Cancel
            </button>
            <button
              className="btn-danger"
              onClick={runDelete}
              disabled={deleteWorking}
            >
              {deleteWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-600 animate-spin" />
              ) : (
                <><Trash2 size={14} /> Delete</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        title="Success"
        message={successMsg}
      />
    </>
  );
};

export default Documents;