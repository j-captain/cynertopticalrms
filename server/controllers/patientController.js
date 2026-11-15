import Patient from '../models/Patient.js';
import { writeAudit } from '../middleware/audit.js';

import path from 'node:path';
import fs from 'node:fs';

/* ────────────────────────────────────────────────────────────────── */
/* Field-level authorization                                          */
/* ────────────────────────────────────────────────────────────────── */
// Non-admins may only change these fields via PUT /patients/:id.
// Admins can change anything not server-controlled.
const NON_ADMIN_EDITABLE = ['frameCode', 'scheme', 'insurance', 'lensType', 'complaint'];

// Fields that are never user-writable, even for admins (guards against
// clients sending stale snapshots of these along with the form body).
const SERVER_CONTROLLED = new Set([
  '_id', '__v', 'createdAt', 'updatedAt',
  'index', 'totalAmount',
  'orderPlaced', 'orderDelivered', 'orderHandedToClient',
  'orderedAt', 'deliveredAt', 'handedAt', 'orderedBy',
  'submissionDate', 'preAuthDate',
  'resendCount',
  'documents',
]);

const isAdmin = (req) => req.user?.role === 'admin';

const normalizeDiagnoses = (input) => {
  if (!Array.isArray(input)) return input;
  return input
    .map((d) => ({
      code: (d?.code || '').trim().toUpperCase(),
      description: (d?.description || '').trim(),
    }))
    .filter((d) => d.code.length > 0 || d.description.length > 0)
    .slice(0, 5);
};

const normalizeScheme = (body) => {
  const scheme = (body.scheme || '').trim();
  if (!['Self-Sponsored (Cash)', 'Insurance'].includes(scheme)) {
    return { error: 'Scheme must be "Self-Sponsored (Cash)" or "Insurance"' };
  }
  const insurance = scheme === 'Insurance' ? (body.insurance || '').trim() : '';
  if (scheme === 'Insurance' && !insurance) {
    return { error: 'Insurance is required when scheme is Insurance' };
  }
  return { scheme, insurance };
};

/* ────────────────────────────────────────────────────────────────── */
/* List / Read                                                        */
/* ────────────────────────────────────────────────────────────────── */
export const listPatients = async (req, res, next) => {
  try {
    const { q, status } = req.query;
    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { systemNumber: { $regex: q, $options: 'i' } },
        { frameCode: { $regex: q, $options: 'i' } },
        { insurance: { $regex: q, $options: 'i' } },
        { scheme: { $regex: q, $options: 'i' } },
        { 'diagnoses.code': { $regex: q, $options: 'i' } },
        { 'diagnoses.description': { $regex: q, $options: 'i' } },
      ];
    }
    if (status === 'ordered') filter.orderPlaced = true;
    if (status === 'pending') filter.orderPlaced = false;
    if (status === 'delivered') filter.orderDelivered = true;
    if (status === 'handed') filter.orderHandedToClient = true;

    const patients = await Patient.find(filter).sort({ createdAt: -1 }).lean();
    const enriched = patients.map((p, i) => ({
      ...p,
      index: i + 1,
      totalAmount: (p.lensAmount || 0) + (p.frameAmount || 0),
    }));
    res.json(enriched);
  } catch (err) {
    next(err);
  }
};

export const getPatient = async (req, res, next) => {
  try {
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    res.json(p);
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Create                                                             */
/* ────────────────────────────────────────────────────────────────── */
export const createPatient = async (req, res, next) => {
  try {
    const body = { ...req.body };

    // Guard: on create, the client may not inject server-controlled
    // bookkeeping fields (order flags, timestamps, resendCount, docs).
    for (const k of SERVER_CONTROLLED) delete body[k];

    body.diagnoses = normalizeDiagnoses(body.diagnoses);
    if (!body.diagnoses || body.diagnoses.length === 0) {
      return res.status(400).json({ message: 'Diagnosis 1 is required' });
    }
    if (!body.complaint || !body.complaint.trim()) {
      return res.status(400).json({ message: 'Complaint is required' });
    }

    const schemeCheck = normalizeScheme(body);
    if (schemeCheck.error) return res.status(400).json({ message: schemeCheck.error });
    body.scheme = schemeCheck.scheme;
    body.insurance = schemeCheck.insurance;

    const p = await Patient.create(body);
    await writeAudit(req, {
      action: 'patient.create',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { name: p.name },
    });
    res.status(201).json(p);
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Update - field-level authorization enforced here                   */
/* ────────────────────────────────────────────────────────────────── */
export const updatePatient = async (req, res, next) => {
  try {
    const body = { ...req.body };

    // 1. Strip server-controlled fields entirely - nobody may touch them
    //    through this endpoint (they have dedicated routes).
    for (const k of SERVER_CONTROLLED) delete body[k];

    // 2. Non-admins are restricted to the whitelist. Reject with 403 if
    //    they try to touch anything outside it (silent dropping would let
    //    a stale client think the field saved).
    if (!isAdmin(req)) {
      const attempted = Object.keys(body);
      const disallowed = attempted.filter((k) => !NON_ADMIN_EDITABLE.includes(k));
      if (disallowed.length) {
        return res.status(403).json({
          message: 'You are not allowed to modify these fields',
          fields: disallowed,
          allowed: NON_ADMIN_EDITABLE,
        });
      }
      if (attempted.length === 0) {
        return res.status(400).json({ message: 'No editable fields provided' });
      }
    }

    // 3. Normalize / validate the whitelist-relevant fields.
    if (body.diagnoses !== undefined) {
      body.diagnoses = normalizeDiagnoses(body.diagnoses);
      if (!body.diagnoses || body.diagnoses.length === 0) {
        return res.status(400).json({ message: 'Diagnosis 1 is required' });
      }
    }
    if (body.complaint !== undefined) {
      if (typeof body.complaint !== 'string' || !body.complaint.trim()) {
        return res.status(400).json({ message: 'Complaint is required' });
      }
    }
    if (body.scheme !== undefined) {
      const schemeCheck = normalizeScheme(body);
      if (schemeCheck.error) return res.status(400).json({ message: schemeCheck.error });
      body.scheme = schemeCheck.scheme;
      body.insurance = schemeCheck.insurance;
    }

    const p = await Patient.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    if (!p) return res.status(404).json({ message: 'Patient not found' });

    await writeAudit(req, {
      action: 'patient.update',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { asRole: req.user?.role || 'unknown', fields: Object.keys(body) },
    });
    res.json(p);
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Delete - already admin-only at the router level                    */
/* ────────────────────────────────────────────────────────────────── */
export const deletePatient = async (req, res, next) => {
  try {
    const p = await Patient.findByIdAndDelete(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    await writeAudit(req, {
      action: 'patient.delete',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { name: p.name },
    });
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Status transition - mark/unmark; unmark is admin-only              */
/* ────────────────────────────────────────────────────────────────── */
export const updateStatus = async (req, res, next) => {
  try {
    const { field, value } = req.body || {};
    const allowed = ['orderDelivered', 'orderHandedToClient'];
    if (!allowed.includes(field)) {
      return res.status(400).json({ message: 'Invalid field' });
    }

    const v = Boolean(value);

    // Undo (value === false) is admin-only - mirrors the UI which hides
    // the undo buttons from non-admins. A direct API call is rejected.
    if (!v && !isAdmin(req)) {
      return res.status(403).json({ message: 'Only admins can undo a status' });
    }

    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });

    // Enforce the natural ordering so the UI cascade can never be
    // bypassed by a direct API call.
    if (field === 'orderDelivered' && v && !p.orderPlaced) {
      return res.status(400).json({ message: 'Order must be placed before it can be delivered' });
    }
    if (field === 'orderHandedToClient' && v && !p.orderDelivered) {
      return res.status(400).json({ message: 'Order must be delivered before it can be handed' });
    }

    const before = {
      orderDelivered: p.orderDelivered,
      orderHandedToClient: p.orderHandedToClient,
      deliveredAt: p.deliveredAt,
      handedAt: p.handedAt,
    };

    if (field === 'orderDelivered') {
      p.orderDelivered = v;
      // Preserve the original timestamp on idempotent true calls.
      p.deliveredAt = v ? (p.deliveredAt || new Date()) : null;
      if (!v) {
        // Un-delivering cascades: a handed order cannot remain handed.
        p.orderHandedToClient = false;
        p.handedAt = null;
      }
    } else if (field === 'orderHandedToClient') {
      p.orderHandedToClient = v;
      p.handedAt = v ? (p.handedAt || new Date()) : null;
    }

    await p.save();

    await writeAudit(req, {
      action: v ? `patient.status.${field}.set` : `patient.status.${field}.unset`,
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: {
        value: v,
        asRole: req.user?.role || 'unknown',
        before,
        after: {
          orderDelivered: p.orderDelivered,
          orderHandedToClient: p.orderHandedToClient,
        },
      },
    });

    res.json(p);
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Mark submitted - editing an already-submitted date is admin-only   */
/* ────────────────────────────────────────────────────────────────── */
export const markSubmitted = async (req, res, next) => {
  try {
    const { submissionDate } = req.body;
    if (!submissionDate) {
      return res.status(400).json({ message: 'Submission date is required' });
    }
    let date;
    if (typeof submissionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(submissionDate)) {
      const [y, m, d] = submissionDate.split('-').map(Number);
      date = new Date(y, m - 1, d, 12, 0, 0);
    } else {
      date = new Date(submissionDate);
    }
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: 'Invalid submission date' });
    }

    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });

    // Non-admins may mark a *not-yet-placed* order as submitted (normal
    // first-submission path). Editing the date of an already-placed order
    // is a correction and admin-only.
    if (p.orderPlaced && !isAdmin(req)) {
      return res.status(403).json({ message: 'Only admins can change an existing submission date' });
    }

    p.orderPlaced = true;
    if (!p.orderedAt) p.orderedAt = new Date();
    if (!p.orderedBy) p.orderedBy = req.user?._id;
    p.submissionDate = date;
    await p.save();

    await writeAudit(req, {
      action: p.orderPlaced ? 'patient.mark_submitted' : 'patient.mark_submitted',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { requested: submissionDate, saved: date.toISOString(), asRole: req.user?.role || 'unknown' },
    });
    res.json({ message: 'Marked as submitted', patient: p });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Documents (unchanged)                                              */
/* ────────────────────────────────────────────────────────────────── */
export const uploadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const kind = (req.query.kind || '').toLowerCase();
    if (!['prescription', 'diagnostic'].includes(kind)) {
      return res.status(400).json({ message: 'kind must be "prescription" or "diagnostic"' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const p = await Patient.findById(id);
    if (!p) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(404).json({ message: 'Patient not found' });
    }

    p.documents = (p.documents || []).filter((d) => d.kind !== kind);
    p.documents.push({
      kind,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      uploadedAt: new Date(),
      uploadedBy: req.user?._id,
    });
    await p.save();

    await writeAudit(req, {
      action: 'patient.document.upload',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { kind, filename: req.file.filename, size: req.file.size },
    });

    res.json({ message: 'Uploaded', documents: p.documents });
  } catch (err) {
    try { if (req.file?.path) fs.unlinkSync(req.file.path); } catch {}
    next(err);
  }
};

export const downloadDocument = async (req, res, next) => {
  try {
    const { id, kind } = req.params;
    if (!['prescription', 'diagnostic'].includes(kind)) {
      return res.status(400).json({ message: 'Invalid kind' });
    }
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    const doc = (p.documents || []).find((d) => d.kind === kind);
    if (!doc) return res.status(404).json({ message: 'No document' });

    const filePath = path.resolve(process.cwd(), 'uploads', 'patients', id, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File missing on disk' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${kind}-${id}.pdf"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
};

export const deleteDocument = async (req, res, next) => {
  try {
    const { id, kind } = req.params;
    if (!['prescription', 'diagnostic'].includes(kind)) {
      return res.status(400).json({ message: 'Invalid kind' });
    }
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    const doc = (p.documents || []).find((d) => d.kind === kind);
    if (!doc) return res.status(404).json({ message: 'No document' });

    const filePath = path.resolve(process.cwd(), 'uploads', 'patients', id, doc.filename);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}

    p.documents = p.documents.filter((d) => d.kind !== kind);
    await p.save();

    await writeAudit(req, {
      action: 'patient.document.delete',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { kind },
    });

    res.json({ message: 'Deleted', documents: p.documents });
  } catch (err) {
    next(err);
  }
};