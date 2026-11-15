import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Upload, Eye, Trash2, AlertCircle, CheckCircle2, Stethoscope,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from './Modal.jsx';
import SuccessModal from './SuccessModal.jsx';
import api from '../lib/api.js';

const SLOTS = [
  { kind: 'prescription', label: 'Optical Prescription', icon: FileText },
  { kind: 'diagnostic', label: 'Optical Diagnostic Form', icon: Stethoscope },
];

const fmtSize = (n) => {
  if (!n) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
};

const DocumentationModal = ({ open, onClose, patient, onChanged }) => {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState({});
  const prescriptionRef = useRef(null);
  const diagnosticRef = useRef(null);
  const inputRefs = { prescription: prescriptionRef, diagnostic: diagnosticRef };

  // Re-upload confirmation state
  const [reuploadKind, setReuploadKind] = useState(null);
  const [reuploadWorking, setReuploadWorking] = useState(false);

  // Delete confirmation state
  const [deleteKind, setDeleteKind] = useState(null);
  const [deleteWorking, setDeleteWorking] = useState(false);

  // Success
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!open) return;
    setDocs(patient?.documents || []);
  }, [open, patient]);

  if (!patient) return null;

  const findDoc = (kind) => docs.find((d) => d.kind === kind);

  const upload = async (kind, file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB');
      return;
    }

    setUploading((u) => ({ ...u, [kind]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.post(
        `/patients/${patient._id}/documents/upload?kind=${kind}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setDocs(r.data.documents || []);
      onChanged?.();
      setSuccessMsg(`${kind === 'prescription' ? 'Prescription' : 'Diagnostic form'} uploaded successfully.`);
      setSuccessOpen(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Upload failed');
    } finally {
      setUploading((u) => ({ ...u, [kind]: false }));
    }
  };

  const openReupload = (kind) => {
    setReuploadKind(kind);
  };

  const proceedReupload = () => {
    setReuploadWorking(true);
    const ref = inputRefs[reuploadKind];
    const kind = reuploadKind;
    setReuploadKind(null);
    setReuploadWorking(false);
    setTimeout(() => {
      ref?.current?.click();
    }, 50);
    // kind unused after this - kept for clarity
    void kind;
  };

  const openDelete = (kind) => {
    setDeleteKind(kind);
  };

  const runDelete = async () => {
    if (!deleteKind) return;
    setDeleteWorking(true);
    try {
      const r = await api.delete(`/patients/${patient._id}/documents/${deleteKind}`);
      setDocs(r.data.documents || []);
      onChanged?.();
      const label = deleteKind === 'prescription' ? 'Prescription' : 'Diagnostic form';
      setDeleteKind(null);
      setSuccessMsg(`${label} deleted successfully.`);
      setSuccessOpen(true);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteWorking(false);
    }
  };

  const openView = (kind) => {
    api
      .get(`/patients/${patient._id}/documents/${kind}`, { responseType: 'blob' })
      .then((res) => {
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch((e) => toast.error(e.response?.data?.message || 'Could not open file'));
  };

  const kindLabel = (kind) =>
    kind === 'prescription' ? 'Optical Prescription' : 'Optical Diagnostic Form';

  return (
    <>
      <Modal open={open} onClose={onClose} title="Documentation" width="max-w-lg">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Upload the patient's prescription and diagnostic form. Only PDF files accepted (max 5 MB each).
          </p>

          {SLOTS.map(({ kind, label, icon: Icon }) => {
            const doc = findDoc(kind);
            const busy = uploading[kind];

            return (
              <motion.div
                key={kind}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className={`mt-0.5 rounded-lg p-2 shrink-0 ${doc ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                      <Icon size={16} className={doc ? 'text-emerald-600' : 'text-slate-500'} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{label}</p>
                      {doc ? (
                        <>
                          <p className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 size={11} /> Uploaded
                          </p>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {doc.originalName} · {fmtSize(doc.size)}
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <AlertCircle size={11} /> Not uploaded
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-3 justify-end">
                  <input
                    ref={inputRefs[kind]}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      upload(kind, f);
                      e.target.value = '';
                    }}
                  />

                  {doc ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openView(kind)}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-slate-100 transition"
                      >
                        <Eye size={12} /> View
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => openReupload(kind)}
                        className="inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-100 text-sky-700 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-sky-100 transition disabled:opacity-50"
                      >
                        {busy ? (
                          <span className="h-3 w-3 rounded-full border-2 border-sky-300 border-t-sky-600 animate-spin" />
                        ) : (
                          <Upload size={12} />
                        )}
                        Reupload
                      </button>
                      <button
                        type="button"
                        onClick={() => openDelete(kind)}
                        className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-100 text-rose-700 px-2.5 py-1.5 text-[11px] font-semibold hover:bg-rose-100 transition"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => inputRefs[kind].current?.click()}
                      className="inline-flex items-center gap-1 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 text-white px-3 py-1.5 text-[11px] font-semibold hover:shadow-md hover:-translate-y-0.5 transition disabled:opacity-50"
                    >
                      {busy ? (
                        <span className="h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      ) : (
                        <Upload size={12} />
                      )}
                      Upload PDF
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="flex justify-end pt-3 mt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors bg-cyan-500 hover:bg-cyan-600 shadow-sm"
          >
            Close
          </button>
        </div>
      </Modal>

      {/* Re-upload confirmation */}
      <Modal
        open={!!reuploadKind}
        onClose={() => !reuploadWorking && setReuploadKind(null)}
        title="Re-upload Document"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-sky-50 grid place-items-center">
            <Upload className="text-sky-600" size={22} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Re-upload the <span className="font-semibold">{kindLabel(reuploadKind)}</span> for{' '}
              <span className="font-semibold">{patient?.name}</span>?
            </p>
            <p className="text-xs text-slate-500 mt-1">
              The existing file will be replaced. This cannot be undone once the new file is uploaded.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Patient</span>
              <span className="font-semibold text-slate-800">{patient?.name}</span>
            </div>
            <div className="flex justify-between">
              <span>System No.</span>
              <span className="font-mono font-semibold text-slate-800">{patient?.systemNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Document</span>
              <span className="font-semibold text-slate-800">{kindLabel(reuploadKind)}</span>
            </div>
            <div className="flex justify-between">
              <span>Current file</span>
              <span className="font-mono text-slate-700 truncate ml-2">
                {findDoc(reuploadKind)?.originalName || '-'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="btn-ghost"
              onClick={() => setReuploadKind(null)}
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
        open={!!deleteKind}
        onClose={() => !deleteWorking && setDeleteKind(null)}
        title="Remove Document"
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
            <AlertTriangle className="text-rose-500" size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              Delete the <span className="font-semibold">{kindLabel(deleteKind)}</span> for{' '}
              <span className="font-semibold">{patient?.name}</span>?
            </p>
            <p className="text-xs text-rose-600 font-semibold mt-1">
              This cannot be undone.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Patient</span>
              <span className="font-semibold text-slate-800">{patient?.name}</span>
            </div>
            <div className="flex justify-between">
              <span>System No.</span>
              <span className="font-mono font-semibold text-slate-800">{patient?.systemNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Document</span>
              <span className="font-semibold text-slate-800">{kindLabel(deleteKind)}</span>
            </div>
            <div className="flex justify-between">
              <span>File</span>
              <span className="font-mono text-slate-700 truncate ml-2">
                {findDoc(deleteKind)?.originalName || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Size</span>
              <span className="font-semibold text-slate-800">
                {fmtSize(findDoc(deleteKind)?.size)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="btn-ghost"
              onClick={() => setDeleteKind(null)}
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

export default DocumentationModal;