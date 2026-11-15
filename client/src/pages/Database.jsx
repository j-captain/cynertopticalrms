import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Database as DatabaseIcon, Download, Upload, Trash2, Eraser,
  AlertTriangle, RefreshCw, ShieldAlert, HardDrive, FileJson,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api.js';
import Modal from '../components/Modal.jsx';
import SuccessModal from '../components/SuccessModal.jsx';

const fmtBytes = (n) => {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
};

const DatabasePage = () => {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Action state
  const [actionType, setActionType] = useState(null);      // 'empty' | 'drop' | 'restore'
  const [actionTarget, setActionTarget] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [confirmWorking, setConfirmWorking] = useState(false);

  // Restore state
  const [restoreMode, setRestoreMode] = useState('upsert'); // 'upsert' | 'replace'
  const [restoreFile, setRestoreFile] = useState(null);
  const restoreInputRef = useRef(null);

  // Success
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Full backup / restore
  const [fullRestoreOpen, setFullRestoreOpen] = useState(false);
  const [fullRestoreFile, setFullRestoreFile] = useState(null);
  const [fullRestoreMode, setFullRestoreMode] = useState('upsert');
  const [fullRestoreWorking, setFullRestoreWorking] = useState(false);
  const fullRestoreInputRef = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/db/collections');
      setData(r.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load DB stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const doExport = async (name) => {
    try {
      const r = await api.get(`/db/export/${name}`, { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${name}`);
    } catch {
      toast.error('Export failed');
    }
  };

  const doExportAll = async () => {
    try {
      const r = await api.get('/db/export-all', { responseType: 'blob' });
      const blob = new Blob([r.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cynert-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Full backup downloaded');
    } catch {
      toast.error('Backup failed');
    }
  };

  const openConfirm = (type, target) => {
    if (target?.protected) {
      toast.error(target.protectedReason || 'This collection is protected');
      return;
    }
    setActionType(type);
    setActionTarget(target);
    setConfirmText('');
    setConfirmOpen(true);
  };

  const runDestructive = async () => {
    if (!actionTarget) return;
    setConfirmWorking(true);
    try {
      if (actionType === 'empty') {
        const r = await api.post(`/db/empty/${actionTarget.name}`);
        setSuccessMsg(`Emptied "${actionTarget.displayName}". Deleted ${r.data.deletedCount} document(s).`);
      } else if (actionType === 'drop') {
        await api.post(`/db/drop/${actionTarget.name}`);
        setSuccessMsg(`Dropped "${actionTarget.displayName}" collection entirely.`);
      }
      setConfirmOpen(false);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setConfirmWorking(false);
    }
  };

  const openRestore = (target) => {
    setActionTarget(target);
    setRestoreFile(null);
    setRestoreMode('upsert');
    setActionType('restore');
  };

  const runRestore = async () => {
    if (!restoreFile || !actionTarget) return;
    setConfirmWorking(true);
    try {
      const text = await restoreFile.text();
      let docs;
      try { docs = JSON.parse(text); } catch { throw new Error('File is not valid JSON'); }
      if (!Array.isArray(docs)) throw new Error('JSON must be an array of documents');

      const r = await api.post(`/db/restore/${actionTarget.name}`, {
        docs,
        mode: restoreMode,
      });
      setActionType(null);
      setSuccessMsg(`Restored ${r.data.total} document(s) into "${actionTarget.displayName}" - inserted ${r.data.inserted}, replaced ${r.data.replaced}, failed ${r.data.failed}.`);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Restore failed');
    } finally {
      setConfirmWorking(false);
    }
  };

  const runFullRestore = async () => {
    if (!fullRestoreFile) return;
    setFullRestoreWorking(true);
    try {
      const text = await fullRestoreFile.text();
      let payload;
      try { payload = JSON.parse(text); } catch { throw new Error('File is not valid JSON'); }

      if (!payload.collections || typeof payload.collections !== 'object') {
        throw new Error('Backup file must contain a "collections" object');
      }

      await api.post('/db/restore-all', {
        collections: payload.collections,
        mode: fullRestoreMode,
      });
      setFullRestoreOpen(false);
      setSuccessMsg(`Full restore completed in ${fullRestoreMode} mode. Check the audit log for details.`);
      setSuccessOpen(true);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Restore failed');
    } finally {
      setFullRestoreWorking(false);
    }
  };

  const db = data?.dbStats || {};
  const collections = data?.collections || [];
  const confirmWord = 'DELETE';

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <DatabaseIcon size={18} className="text-sky-600" /> Database
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {data ? `${data.dbName} · ${data.collections?.length ?? 0} collection(s)` : 'Loading…'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-ghost !py-1.5 !px-3 !text-xs">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={doExportAll} className="btn-primary !py-1.5 !px-3 !text-xs">
            <Download size={13} /> Full Backup
          </button>
          <button
            onClick={() => { setFullRestoreFile(null); setFullRestoreMode('upsert'); setFullRestoreOpen(true); }}
            className="btn-ghost !py-1.5 !px-3 !text-xs"
          >
            <Upload size={13} /> Full Restore
          </button>
        </div>
      </div>

      {/* DB stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Documents</p>
          <p className="text-lg font-extrabold text-slate-900 mt-0.5">{db.documents ?? 0}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Collections</p>
          <p className="text-lg font-extrabold text-slate-900 mt-0.5">{db.collections ?? 0}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Data Size</p>
          <p className="text-lg font-extrabold text-sky-600 mt-0.5">{fmtBytes(db.dataSize)}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] uppercase tracking-wide font-semibold text-slate-400">Storage</p>
          <p className="text-lg font-extrabold text-indigo-600 mt-0.5">{fmtBytes(db.storageSize)}</p>
        </div>
      </div>

      {/* Collections table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider">
                <th className="px-3 py-2 text-left font-semibold">Collection</th>
                <th className="px-3 py-2 text-left font-semibold">Mongo Name</th>
                <th className="px-3 py-2 text-right font-semibold">Documents</th>
                <th className="px-3 py-2 text-right font-semibold">Size</th>
                <th className="px-3 py-2 text-right font-semibold">Indexes</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">Loading…</td></tr>
              )}
              {!loading && collections.map((c, i) => (
                <motion.tr
                  key={c.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-t border-slate-100 hover:bg-sky-50/40"
                >
                  <td className="px-3 py-2 font-semibold text-slate-800 flex items-center gap-2">
                    <HardDrive size={12} className="text-slate-400" />
                    {c.displayName}
                    {c.protected && (
                      <ShieldAlert size={12} className="text-amber-500" title={c.protectedReason} />
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-500 font-mono">{c.name}</td>
                  <td className="px-3 py-2 text-right text-slate-700 tabular-nums">{c.count.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-slate-600 tabular-nums">{fmtBytes(c.sizeBytes)}</td>
                  <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{c.indexCount}</td>
                  <td className="px-3 py-2">
                    {!c.exists ? (
                      <span className="badge bg-slate-100 text-slate-500">Not created</span>
                    ) : c.count === 0 ? (
                      <span className="badge bg-amber-50 text-amber-700">Empty</span>
                    ) : (
                      <span className="badge bg-emerald-50 text-emerald-700">Active</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/database/${c.name}`)}
                        disabled={!c.exists}
                        className="inline-flex items-center gap-1 rounded-md bg-sky-50 text-sky-700 border border-sky-100 px-2 py-1 text-[10px] font-semibold hover:bg-sky-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="View documents"
                      >
                        <Eye size={10} /> View
                      </button>
                      <button
                        onClick={() => doExport(c.name)}
                        disabled={!c.exists}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-600 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Export as JSON"
                      >
                        <Download size={10} /> Export
                      </button>
                      <button
                        onClick={() => openRestore(c)}
                        className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 text-slate-600 px-2 py-1 text-[10px] font-semibold hover:bg-slate-50 transition"
                        title="Restore from JSON"
                      >
                        <Upload size={10} /> Restore
                      </button>
                      <button
                        onClick={() => openConfirm('empty', c)}
                        disabled={!c.exists || c.protected}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 text-[10px] font-semibold hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Delete all documents but keep the collection"
                      >
                        <Eraser size={10} /> Empty
                      </button>
                      <button
                        onClick={() => openConfirm('drop', c)}
                        disabled={!c.exists || c.protected}
                        className="inline-flex items-center gap-1 rounded-md bg-red-50 text-red-700 border border-red-100 px-2 py-1 text-[10px] font-semibold hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        title="Delete the collection entirely"
                      >
                        <Trash2 size={10} /> Drop
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Destructive confirm (empty / drop) */}
      <Modal
        open={confirmOpen}
        onClose={() => !confirmWorking && setConfirmOpen(false)}
        title={actionType === 'empty' ? 'Empty collection' : 'Drop collection'}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 grid place-items-center">
            <AlertTriangle className="text-rose-500" size={24} />
          </div>
          <div className="text-center">
            <p className="text-sm text-slate-700">
              {actionType === 'empty' ? (
                <>Delete <span className="font-bold text-rose-600">ALL</span> documents in <span className="font-semibold">{actionTarget?.displayName}</span>?</>
              ) : (
                <>Drop the entire <span className="font-semibold">{actionTarget?.displayName}</span> collection?</>
              )}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {actionType === 'empty'
                ? 'The collection stays but every document inside is permanently removed.'
                : 'The collection is deleted entirely. You will need to reseed or restore from backup.'}
            </p>
            <p className="text-xs text-rose-600 font-semibold mt-2">
              This cannot be undone. A backup is strongly recommended first.
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Collection</span>
              <span className="font-mono font-semibold text-slate-800">{actionTarget?.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Current documents</span>
              <span className="font-semibold text-slate-800">{actionTarget?.count?.toLocaleString() ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Size</span>
              <span className="font-semibold text-slate-800">{fmtBytes(actionTarget?.sizeBytes)}</span>
            </div>
          </div>

          <div>
            <label className="label">
              Type <span className="font-mono font-bold text-rose-600">{confirmWord}</span> to confirm
            </label>
            <input
              className="input font-mono"
              placeholder={confirmWord}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button className="btn-ghost" onClick={() => setConfirmOpen(false)} disabled={confirmWorking}>
              Cancel
            </button>
            <button
              className="btn-danger"
              onClick={runDestructive}
              disabled={confirmText !== confirmWord || confirmWorking}
            >
              {confirmWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-red-300 border-t-red-600 animate-spin" />
              ) : actionType === 'empty' ? (
                <><Eraser size={14} /> Empty</>
              ) : (
                <><Trash2 size={14} /> Drop</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Restore one collection */}
      <Modal
        open={actionType === 'restore'}
        onClose={() => !confirmWorking && setActionType(null)}
        title={`Restore ${actionTarget?.displayName || ''}`}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span>Target collection</span>
              <span className="font-mono font-semibold text-slate-800">{actionTarget?.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Current documents</span>
              <span className="font-semibold text-slate-800">{actionTarget?.count?.toLocaleString() ?? 0}</span>
            </div>
          </div>

          <div>
            <label className="label">JSON file (must be an array of documents)</label>
            <input
              ref={restoreInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <FileJson size={14} /> {restoreFile ? restoreFile.name : 'Choose file…'}
              </span>
              <span className="text-slate-400 text-[10px]">
                {restoreFile ? `${(restoreFile.size / 1024).toFixed(1)} KB` : 'No file selected'}
              </span>
            </button>
          </div>

          <div>
            <label className="label">Restore mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRestoreMode('upsert')}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  restoreMode === 'upsert'
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold">Merge (upsert)</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  Keeps existing docs, adds/replaces by _id
                </div>
              </button>
              <button
                type="button"
                onClick={() => setRestoreMode('replace')}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  restoreMode === 'replace'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold">Replace (wipe)</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                  Deletes existing, then inserts file
                </div>
              </button>
            </div>
          </div>

          {restoreMode === 'replace' && (
            <p className="text-[11px] text-rose-600 flex items-center gap-1">
              <AlertTriangle size={11} /> All existing documents in this collection will be deleted before restore.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setActionType(null)} disabled={confirmWorking}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={runRestore}
              disabled={!restoreFile || confirmWorking}
            >
              {confirmWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Upload size={14} /> Restore</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Full restore */}
      <Modal
        open={fullRestoreOpen}
        onClose={() => !fullRestoreWorking && setFullRestoreOpen(false)}
        title="Full Database Restore"
        width="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Restore from a file created by <b>Full Backup</b>. Includes every allowed collection.
          </p>

          <div>
            <label className="label">Backup file</label>
            <input
              ref={fullRestoreInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => setFullRestoreFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={() => fullRestoreInputRef.current?.click()}
              className="w-full flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <FileJson size={14} /> {fullRestoreFile ? fullRestoreFile.name : 'Choose file…'}
              </span>
              <span className="text-slate-400 text-[10px]">
                {fullRestoreFile ? `${(fullRestoreFile.size / 1024).toFixed(1)} KB` : 'No file selected'}
              </span>
            </button>
          </div>

          <div>
            <label className="label">Restore mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFullRestoreMode('upsert')}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  fullRestoreMode === 'upsert'
                    ? 'border-sky-500 bg-sky-50 text-sky-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold">Merge</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">Safe, preserves existing</div>
              </button>
              <button
                type="button"
                onClick={() => setFullRestoreMode('replace')}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  fullRestoreMode === 'replace'
                    ? 'border-rose-500 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="font-semibold">Replace</div>
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">Wipes each collection first</div>
              </button>
            </div>
          </div>

          {fullRestoreMode === 'replace' && (
            <p className="text-[11px] text-rose-600 flex items-center gap-1">
              <AlertTriangle size={11} /> Every allowed collection in the file will be wiped before restore. Users collection is skipped for safety.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => setFullRestoreOpen(false)} disabled={fullRestoreWorking}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={runFullRestore}
              disabled={!fullRestoreFile || fullRestoreWorking}
            >
              {fullRestoreWorking ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              ) : (
                <><Upload size={14} /> Restore</>
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
    </div>
  );
};

export default DatabasePage;