import crypto from 'node:crypto';
import Patient from '../models/Patient.js';
import User from '../models/User.js';
import BillingBatch from '../models/BillingBatch.js';
import { env } from '../config/env.js';
import { writeAudit } from '../middleware/audit.js';
import {
  sendNewOrderToOptician,
  sendBillToDirector,
  sendBillingBatchEmail,
} from '../utils/mailer.js';

const requireRole = (req, roles) => roles.includes(req.user?.role);

const publicPatient = (p) => ({
  _id: p._id,
  index: p.index,
  patientName: p.name,
  systemNumber: p.systemNumber,
  scheme: p.scheme,
  insurance: p.insurance,
  lensType: p.lensType,
  rxBe: p.rxBe,
  rxAdd: p.rxAdd,
  rxPd: p.rxPd,
  diagnoses: p.diagnoses || [],
  complaint: p.complaint,
  lensAmount: p.lensAmount,
  frameCode: p.frameCode,
  frameAmount: p.frameAmount,
  totalAmount: (p.lensAmount || 0) + (p.frameAmount || 0),
  submissionDate: p.submissionDate,
  orderPlaced: p.orderPlaced,
  orderDelivered: p.orderDelivered,
  orderHandedToClient: p.orderHandedToClient,
  billingStatus: p.billingStatus || 'pending_billing',
  billing: p.billing || null,
  deliveredBy: p.deliveredBy,
  deliveredByName: p.deliveredByName,
  deliveredAt: p.deliveredAt,
  emailSentCount: p.emailSentCount || 0,
  emailFailedCount: p.emailFailedCount || 0,
  lastEmailTo: p.lastEmailTo || null,
  emailMode: p.emailMode || 'full',
  updatedAt: p.updatedAt,
  createdAt: p.createdAt,
});

/* ────────────────────────────────────────────────────────────────── */
/* Pending - orders awaiting optician billing                        */
/* ────────────────────────────────────────────────────────────────── */
export const pendingOrders = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { q } = req.query;
    const filter = { billingStatus: 'pending_billing' };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { systemNumber: { $regex: q, $options: 'i' } },
        { lensType: { $regex: q, $options: 'i' } },
        { frameCode: { $regex: q, $options: 'i' } },
        { insurance: { $regex: q, $options: 'i' } },
      ];
    }
    const rows = await Patient.find(filter).sort({ updatedAt: -1 }).lean();
    res.json(rows.map((p, i) => publicPatient({ ...p, index: i + 1 })));
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Billed - optician's draft queue (billed but NOT yet submitted)    */
/* ────────────────────────────────────────────────────────────────── */
export const opticianBilledOrders = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { q } = req.query;
    const filter = { billingStatus: 'billed' };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { systemNumber: { $regex: q, $options: 'i' } },
        { lensType: { $regex: q, $options: 'i' } },
        { frameCode: { $regex: q, $options: 'i' } },
        { insurance: { $regex: q, $options: 'i' } },
      ];
    }
    const rows = await Patient.find(filter).sort({ updatedAt: -1 }).lean();
    res.json(rows.map((p, i) => publicPatient({ ...p, index: i + 1 })));
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* All - everything the optician has billed or submitted             */
/* ────────────────────────────────────────────────────────────────── */
export const allOrdersForOptician = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { q } = req.query;
    const filter = { billingStatus: { $in: ['billed', 'submitted_to_director', 'paid', 'delivered'] } };
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { systemNumber: { $regex: q, $options: 'i' } },
        { lensType: { $regex: q, $options: 'i' } },
      ];
    }
    const rows = await Patient.find(filter).sort({ updatedAt: -1 }).lean();
    res.json(rows.map((p, i) => publicPatient({ ...p, index: i + 1 })));
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Optician summary                                                   */
/* ────────────────────────────────────────────────────────────────── */
export const opticianSummary = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const [pending, draft, submitted, paid, delivered, cancelled] = await Promise.all([
      Patient.countDocuments({ billingStatus: 'pending_billing' }),
      Patient.countDocuments({ billingStatus: 'billed' }),
      Patient.countDocuments({ billingStatus: 'submitted_to_director' }),
      Patient.countDocuments({ billingStatus: 'paid' }),
      Patient.countDocuments({ billingStatus: 'delivered' }),
      BillingBatch.countDocuments({ status: 'cancelled' }),
    ]);

    const pendingAgg = await Patient.aggregate([
      { $match: { billingStatus: 'pending_billing' } },
      { $group: { _id: null, lens: { $sum: '$lensAmount' }, frame: { $sum: '$frameAmount' } } },
    ]);

    const billedAgg = await Patient.aggregate([
      {
        $match: {
          billingStatus: { $in: ['billed', 'submitted_to_director', 'paid', 'delivered'] },
        },
      },
      { $group: { _id: null, total: { $sum: '$billing.total' } } },
    ]);

    const draftAgg = await Patient.aggregate([
      { $match: { billingStatus: 'billed' } },
      { $group: { _id: null, total: { $sum: '$billing.total' } } },
    ]);

    const submittedBatchAgg = await BillingBatch.aggregate([
      { $match: { status: 'submitted' } },
      { $group: { _id: null, fargo: { $sum: '$fargoAmount' }, grand: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]);

    const paidBatchAgg = await BillingBatch.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, fargo: { $sum: '$fargoAmount' }, grand: { $sum: '$grandTotal' }, count: { $sum: 1 } } },
    ]);

    const p = pendingAgg[0] || { lens: 0, frame: 0 };
    const b = billedAgg[0] || { total: 0 };
    const d = draftAgg[0] || { total: 0 };
    const s = submittedBatchAgg[0] || { fargo: 0, grand: 0, count: 0 };
    const pd = paidBatchAgg[0] || { fargo: 0, grand: 0, count: 0 };

    res.json({
      // order-level counts
      pendingCount: pending,
      draftCount: draft,
      submittedOrderCount: submitted,
      paidOrderCount: paid,
      deliveredCount: delivered,
      cancelledBatchCount: cancelled,

      // order-level totals
      pendingLensTotal: p.lens,
      pendingFrameTotal: p.frame,
      pendingTotal: (p.lens || 0) + (p.frame || 0),
      draftTotal: d.total,
      billedTotal: b.total,

      // batch-level counts + totals
      submittedBatchCount: s.count,
      paidBatchCount: pd.count,
      fargoTotal: s.fargo + pd.fargo,
      submittedBatchTotal: s.grand,
      paidBatchTotal: pd.grand,
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Submit bill - creates a draft (billingStatus stays 'billed')      */
/* NO fargo. NO director email. The batch submit will do both.      */
/* ────────────────────────────────────────────────────────────────── */
export const submitBill = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { id } = req.params;
    const { lenses = 0, frame = 0, fitting = 0, caseAmount = 0 } = req.body || {};

    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'pending_billing') {
      return res.status(400).json({ message: 'This order is not pending billing' });
    }

    const n = (v) => Math.max(0, Number(v) || 0);
    const bill = {
      lenses: n(lenses),
      frame: n(frame),
      fitting: n(fitting),
      caseAmount: n(caseAmount),
    };
    bill.total = bill.lenses + bill.frame + bill.fitting + bill.caseAmount;

    p.billing = {
      ...bill,
      billedBy: req.user._id,
      billedByName: req.user.name,
      billedAt: new Date(),
      fargo: 0,
      batchId: null,
    };
    p.billingStatus = 'billed';   // ← stays billed; not yet visible to director
    await p.save();

    // NO director email here - that fires on batch submit

    await writeAudit(req, {
      action: 'billing.submit',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { total: bill.total },
    });

    res.json({ message: 'Bill recorded (draft). Submit batch to push to director.', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Edit bill - draft-only, before submit                             */
/* ────────────────────────────────────────────────────────────────── */
export const opticianEditBill = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { id } = req.params;
    const { lenses = 0, frame = 0, fitting = 0, caseAmount = 0 } = req.body || {};

    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'billed') {
      return res.status(400).json({ message: 'Only draft bills can be edited' });
    }

    const n = (v) => Math.max(0, Number(v) || 0);
    const prev = p.billing || {};
    const bill = {
      lenses: n(lenses),
      frame: n(frame),
      fitting: n(fitting),
      caseAmount: n(caseAmount),
    };
    bill.total = bill.lenses + bill.frame + bill.fitting + bill.caseAmount;

    p.billing = {
      ...prev,
      ...bill,
      billedBy: prev.billedBy || req.user._id,
      billedByName: prev.billedByName || req.user.name,
      billedAt: prev.billedAt || new Date(),
    };
    await p.save();

    await writeAudit(req, {
      action: 'billing.optician_edit',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { total: bill.total, previous: prev.total },
    });

    res.json({ message: 'Bill updated', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Deliver (legacy endpoint)                                         */
/* HARDENED: only submitted_to_director or paid orders can be        */
/* delivered. Draft ('billed') orders must go through a batch submit */
/* first, then be delivered via /undelivered/*.                      */
/* ────────────────────────────────────────────────────────────────── */
export const deliverOrder = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { id } = req.params;
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (!['submitted_to_director', 'paid'].includes(p.billingStatus)) {
      return res.status(400).json({
        message: 'Only submitted or paid orders can be delivered. Submit the bill batch first.',
      });
    }

    p.billingStatus = 'delivered';
    p.orderDelivered = true;
    p.deliveredAt = p.deliveredAt || new Date();
    p.deliveredBy = req.user._id;
    p.deliveredByName = req.user.name;
    await p.save();

    await writeAudit(req, {
      action: 'order.deliver',
      resource: 'Patient',
      resourceId: p._id.toString(),
    });

    res.json({ message: 'Order marked delivered', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Complete Billing - the batch submit (was fargo batch)             */
/*                                                                    */
/* Body: { orderIds: string[], fargo: number }                        */
/*                                                                    */
/* What it does:                                                     */
/*   1. Creates a BillingBatch record                                */
/*   2. Flips every selected order's billingStatus to                */
/*      'submitted_to_director'                                      */
/*   3. Snapshots ordersTotal + grandTotal for the director          */
/*   4. Emails director + all active admins                          */
/*                                                                    */
/* After this, the order is visible to the director, grouped as      */
/* one batch row. Individual drafts no longer appear separately.     */
/* ────────────────────────────────────────────────────────────────── */
export const completeBilling = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }

    const { orderIds, fargo } = req.body || {};
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ message: 'Select at least one order' });
    }
    const fargoAmount = Math.max(0, Number(fargo) || 0);

    const orders = await Patient.find({ _id: { $in: orderIds } });
    if (orders.length !== orderIds.length) {
      return res.status(400).json({ message: 'One or more selected orders could not be found' });
    }

    for (const p of orders) {
      if (p.billingStatus !== 'billed') {
        return res.status(400).json({
          message: `${p.name} (${p.systemNumber}) is not a draft bill (status: ${p.billingStatus})`,
        });
      }
      if (p.billing?.batchId) {
        return res.status(400).json({
          message: `${p.name} (${p.systemNumber}) already belongs to a batch`,
        });
      }
    }

    const ordersTotal = orders.reduce((s, p) => s + (p.billing?.total || 0), 0);
    const grandTotal = ordersTotal + fargoAmount;

    const today = new Date();
    const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const seq = (await BillingBatch.countDocuments({
      createdAt: { $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()) },
    })) + 1;
    const batchNumber = `BILL-${yyyymmdd}-${String(seq).padStart(3, '0')}`;

    const batch = await BillingBatch.create({
      batchNumber,
      orderIds: orders.map((p) => p._id),
      fargoAmount,
      ordersTotal,
      grandTotal,
      status: 'submitted',
      submittedBy: req.user._id,
      submittedByName: req.user.name,
      submittedAt: new Date(),
    });

    await Patient.updateMany(
      { _id: { $in: orders.map((p) => p._id) } },
      {
        $set: {
          billingStatus: 'submitted_to_director',
          'billing.batchId': batch._id,
          'billing.fargo': 0,
        },
      }
    );

    /* ── Recipients ── */
    const recipients = [];
    if (env.DIRECTOR_EMAIL) recipients.push(env.DIRECTOR_EMAIL);
    const admins = await User.find({ role: 'admin', isActive: true }).select('email').lean();
    for (const a of admins) recipients.push(a.email);

    /* ── Send: pick director vs admin template per recipient ── */
    const DIRECTOR_EMAIL_NORM = String(env.DIRECTOR_EMAIL || '').trim().toLowerCase();
    const results = await Promise.allSettled(
      recipients.map((to) => {
        const role =
          String(to).trim().toLowerCase() === DIRECTOR_EMAIL_NORM ? 'director' : 'admin';
        return sendBillingBatchEmail({
          to,
          batchNumber,
          opticianName: req.user.name,
          orders,
          fargoAmount,
          ordersTotal,
          grandTotal,
          recipientRole: role,
        });
      })
    );

    const emailErrors = results
      .filter((r) => r.status === 'rejected')
      .map((r) => r.reason?.message || 'unknown');

    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.error(`📧 Batch ${batchNumber} → ${recipients[i]} FAILED:`, r.reason?.message);
      } else {
        console.log(`📧 Batch ${batchNumber} → ${recipients[i]} OK (${r.value?.messageId || 'simulated'})`);
      }
    });

    await writeAudit(req, {
      action: 'billing.complete_batch',
      resource: 'BillingBatch',
      resourceId: batch._id.toString(),
      meta: {
        batchNumber,
        orderCount: orders.length,
        ordersTotal,
        fargoAmount,
        grandTotal,
        emailsSent: results.filter((r) => r.status === 'fulfilled').length,
        emailErrors,
      },
    });

    res.json({
      message: 'Billing completed. Director and admins notified.',
      batch: {
        _id: batch._id,
        batchNumber: batch.batchNumber,
        orderCount: orders.length,
        ordersTotal: batch.ordersTotal,
        fargoAmount: batch.fargoAmount,
        grandTotal: batch.grandTotal,
      },
      emailsSent: results.filter((r) => r.status === 'fulfilled').length,
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* List batches - director + admin + optician                        */
/* ────────────────────────────────────────────────────────────────── */
export const listBatches = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'director', 'admin'])) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    const rows = await BillingBatch.find(filter)
      .sort({ submittedAt: -1 })
      .limit(500)
      .populate('orderIds', 'name systemNumber lensType billing billingStatus')
      .lean();
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Cancel batch - admin only                                          */
/* ────────────────────────────────────────────────────────────────── */
export const cancelBatch = async (req, res, next) => {
  try {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }
    const batch = await BillingBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (batch.status !== 'submitted') {
      return res.status(400).json({ message: 'Only submitted batches can be cancelled' });
    }

    batch.status = 'cancelled';
    await batch.save();

    // Revert orders back to draft
    await Patient.updateMany(
      { _id: { $in: batch.orderIds }, billingStatus: 'submitted_to_director' },
      { $set: { billingStatus: 'billed', 'billing.batchId': null } }
    );

    await writeAudit(req, {
      action: 'billing.batch_cancelled',
      resource: 'BillingBatch',
      resourceId: batch._id.toString(),
      meta: { batchNumber: batch.batchNumber },
    });

    res.json({ message: 'Batch cancelled' });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Director - list batches (not individual orders)                   */
/*                                                                    */
/* `status` query: 'unpaid' → submitted batches                      */
/*                 'paid'   → paid batches                           */
/*                 'all'    → everything non-cancelled               */
/* ────────────────────────────────────────────────────────────────── */
export const directorBatches = async (req, res, next) => {
  try {
    if (!requireRole(req, ['director', 'admin'])) {
      return res.status(403).json({ message: 'Director or admin only' });
    }
    const { q, status } = req.query;
    const filter = {};
    if (status === 'paid') filter.status = 'paid';
    else if (status === 'unpaid') filter.status = 'submitted';
    else filter.status = { $in: ['submitted', 'paid'] };

    const rows = await BillingBatch.find(filter)
      .sort({ submittedAt: -1 })
      .populate('orderIds', 'name systemNumber lensType billing')
      .lean();

    // Optional search: filter batches whose order names/systems match
    const needle = (q || '').trim().toLowerCase();
    const filtered = needle
      ? rows.filter((b) =>
          (b.orderIds || []).some(
            (o) =>
              (o.name || '').toLowerCase().includes(needle) ||
              (o.systemNumber || '').toLowerCase().includes(needle)
          ) || (b.batchNumber || '').toLowerCase().includes(needle)
        )
      : rows;

    res.json(filtered);
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Director - mark a batch paid → flips all its orders to 'paid'     */
/*                                                                    */
/* IMPORTANT: every non-delivered order in the batch is flipped,     */
/* regardless of whether its current state is submitted_to_director  */
/* or already paid. This guarantees the batch-level "paid" status    */
/* and the order-level paid counts always agree.                     */
/* ────────────────────────────────────────────────────────────────── */
export const markBatchPaid = async (req, res, next) => {
  try {
    if (!requireRole(req, ['director', 'admin'])) {
      return res.status(403).json({ message: 'Director or admin only' });
    }
    const batch = await BillingBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (batch.status !== 'submitted') {
      return res.status(400).json({ message: 'Only submitted batches can be marked paid' });
    }

    batch.status = 'paid';
    batch.paidAt = new Date();
    batch.paidBy = req.user._id;
    batch.paidByName = req.user.name;
    await batch.save();

    // Flip EVERY non-delivered order in the batch.
    await Patient.updateMany(
      { _id: { $in: batch.orderIds }, billingStatus: { $ne: 'delivered' } },
      {
        $set: {
          billingStatus: 'paid',
          'billing.paidAt': new Date(),
          'billing.paidBy': req.user._id,
          'billing.paidByName': req.user.name,
        },
      }
    );

    await writeAudit(req, {
      action: 'billing.batch_paid',
      resource: 'BillingBatch',
      resourceId: batch._id.toString(),
      meta: { batchNumber: batch.batchNumber },
    });

    res.json({ message: 'Batch marked paid' });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Director summary                                                   */
/* ────────────────────────────────────────────────────────────────── */
export const directorSummary = async (req, res, next) => {
  try {
    if (!requireRole(req, ['director', 'admin'])) {
      return res.status(403).json({ message: 'Director or admin only' });
    }
    const [submitted, paid, deliveredOrders] = await Promise.all([
      BillingBatch.countDocuments({ status: 'submitted' }),
      BillingBatch.countDocuments({ status: 'paid' }),
      Patient.countDocuments({ billingStatus: 'delivered' }),
    ]);
    const unpaidAgg = await BillingBatch.aggregate([
      { $match: { status: 'submitted' } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } },
    ]);
    const paidAgg = await BillingBatch.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, total: { $sum: '$grandTotal' } } },
    ]);
    res.json({
      newOrders: submitted,
      billed: submitted,
      paid,
      delivered: deliveredOrders,
      unpaidTotal: (unpaidAgg[0] || {}).total || 0,
      paidTotal: (paidAgg[0] || {}).total || 0,
      fargoTotal: 0,   // fargo is inside batch.grandTotal now
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Admin overview - order-level (all statuses)                       */
/* ────────────────────────────────────────────────────────────────── */
export const adminBillingOverview = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const { q, status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.billingStatus = status;
    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { systemNumber: { $regex: q, $options: 'i' } },
        { lensType: { $regex: q, $options: 'i' } },
        { frameCode: { $regex: q, $options: 'i' } },
        { insurance: { $regex: q, $options: 'i' } },
      ];
    }
    const rows = await Patient.find(filter).sort({ updatedAt: -1 }).lean();
    res.json(rows.map((p, i) => publicPatient({ ...p, index: i + 1 })));
  } catch (err) {
    next(err);
  }
};

export const adminBillingSummary = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const statuses = ['pending_billing', 'billed', 'submitted_to_director', 'paid', 'delivered'];
    const counts = {};
    for (const s of statuses) counts[s] = await Patient.countDocuments({ billingStatus: s });

    const totalAgg = await Patient.aggregate([
      { $match: { billingStatus: { $in: ['billed', 'submitted_to_director', 'paid', 'delivered'] } } },
      {
        $group: {
          _id: null,
          billedTotal: { $sum: { $cond: [{ $eq: ['$billingStatus', 'billed'] }, '$billing.total', 0] } },
          submittedTotal: { $sum: { $cond: [{ $eq: ['$billingStatus', 'submitted_to_director'] }, '$billing.total', 0] } },
          paidTotal: { $sum: { $cond: [{ $in: ['$billingStatus', ['paid', 'delivered']] }, '$billing.total', 0] } },
          allTotal: { $sum: '$billing.total' },
        },
      },
    ]);
    const batchFargoAgg = await BillingBatch.aggregate([
      { $match: { status: { $in: ['submitted', 'paid'] } } },
      { $group: { _id: null, fargo: { $sum: '$fargoAmount' } } },
    ]);
    const t = totalAgg[0] || { billedTotal: 0, submittedTotal: 0, paidTotal: 0, allTotal: 0 };

    res.json({
      pendingCount: counts.pending_billing,
      billedCount: counts.billed,
      submittedCount: counts.submitted_to_director,
      paidCount: counts.paid,
      deliveredCount: counts.delivered,
      billedTotal: t.billedTotal,
      submittedTotal: t.submittedTotal,
      paidTotal: t.paidTotal,
      grandTotal: t.allTotal,
      fargoTotal: (batchFargoAgg[0] || {}).fargo || 0,
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Admin override paths - order-level                                */
/* ────────────────────────────────────────────────────────────────── */
export const adminBillOrder = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) return res.status(403).json({ message: 'Admin only' });
    const { id } = req.params;
    const { lenses = 0, frame = 0, fitting = 0, caseAmount = 0 } = req.body || {};
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'pending_billing') {
      return res.status(400).json({ message: 'This order is not pending billing. Use Edit instead.' });
    }
    const n = (v) => Math.max(0, Number(v) || 0);
    const bill = { lenses: n(lenses), frame: n(frame), fitting: n(fitting), caseAmount: n(caseAmount) };
    bill.total = bill.lenses + bill.frame + bill.fitting + bill.caseAmount;
    p.billing = { ...bill, billedBy: req.user._id, billedByName: req.user.name, billedAt: new Date(), fargo: 0, batchId: null };
    p.billingStatus = 'billed';
    await p.save();
    await writeAudit(req, { action: 'billing.admin_bill', resource: 'Patient', resourceId: p._id.toString(), meta: { total: bill.total } });
    res.json({ message: 'Bill submitted', patient: publicPatient(p) });
  } catch (err) { next(err); }
};

export const adminEditBill = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) return res.status(403).json({ message: 'Admin only' });
    const { id } = req.params;
    const { lenses = 0, frame = 0, fitting = 0, caseAmount = 0 } = req.body || {};
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus === 'pending_billing') {
      return res.status(400).json({ message: 'Order is not billed yet. Use Bill instead.' });
    }
    // Guard: batched orders must be cancelled first so batch snapshot stays honest
    if (p.billing?.batchId) {
      return res.status(400).json({
        message: 'This order belongs to a submitted batch. Cancel the batch before editing.',
      });
    }
    const n = (v) => Math.max(0, Number(v) || 0);
    const bill = { lenses: n(lenses), frame: n(frame), fitting: n(fitting), caseAmount: n(caseAmount) };
    bill.total = bill.lenses + bill.frame + bill.fitting + bill.caseAmount;
    const prev = p.billing || {};
    p.billing = {
      ...prev,
      ...bill,
      billedBy: prev.billedBy || req.user._id,
      billedByName: prev.billedByName || req.user.name,
      billedAt: prev.billedAt || new Date(),
    };
    await p.save();
    await writeAudit(req, { action: 'billing.admin_edit', resource: 'Patient', resourceId: p._id.toString(), meta: { total: bill.total, previous: prev.total } });
    res.json({ message: 'Bill updated', patient: publicPatient(p) });
  } catch (err) { next(err); }
};

export const adminRevertToPending = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) return res.status(403).json({ message: 'Admin only' });
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billing?.batchId) {
      return res.status(400).json({
        message: 'This order belongs to a submitted batch. Cancel the batch first.',
      });
    }
    const previousStatus = p.billingStatus;
    p.billingStatus = 'pending_billing';
    p.billing = undefined;
    p.deliveredBy = undefined;
    p.deliveredByName = undefined;
    p.orderDelivered = false;
    p.deliveredAt = undefined;
    await p.save({ validateBeforeSave: false });
    await writeAudit(req, { action: 'billing.admin_revert', resource: 'Patient', resourceId: p._id.toString(), meta: { previousStatus } });
    res.json({ message: 'Reverted to pending', patient: publicPatient(p) });
  } catch (err) { next(err); }
};

export const adminMarkPaid = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) return res.status(403).json({ message: 'Admin only' });
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (!['billed', 'submitted_to_director'].includes(p.billingStatus)) {
      return res.status(400).json({ message: 'Only billed/submitted orders can be marked paid' });
    }
    p.billingStatus = 'paid';
    p.billing = p.billing || {};
    p.billing.paidAt = new Date();
    p.billing.paidBy = req.user._id;
    p.billing.paidByName = req.user.name;
    await p.save();
    await writeAudit(req, { action: 'billing.admin_mark_paid', resource: 'Patient', resourceId: p._id.toString() });
    res.json({ message: 'Marked as paid', patient: publicPatient(p) });
  } catch (err) { next(err); }
};

export const adminRevertToBilled = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) return res.status(403).json({ message: 'Admin only' });
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'paid') return res.status(400).json({ message: 'Only paid orders can be reverted to billed' });
    p.billingStatus = 'billed';
    if (p.billing) { p.billing.paidAt = undefined; p.billing.paidBy = undefined; p.billing.paidByName = undefined; }
    await p.save();
    await writeAudit(req, { action: 'billing.admin_revert_billed', resource: 'Patient', resourceId: p._id.toString() });
    res.json({ message: 'Reverted to billed', patient: publicPatient(p) });
  } catch (err) { next(err); }
};

export const adminDeliver = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) return res.status(403).json({ message: 'Admin only' });
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus === 'delivered') return res.status(400).json({ message: 'Already delivered' });
    if (p.billingStatus === 'pending_billing') return res.status(400).json({ message: 'Cannot deliver an unbilled order' });
    p.billingStatus = 'delivered';
    p.orderDelivered = true;
    p.deliveredAt = p.deliveredAt || new Date();
    p.deliveredBy = req.user._id;
    p.deliveredByName = req.user.name;
    await p.save();
    await writeAudit(req, { action: 'billing.admin_deliver', resource: 'Patient', resourceId: p._id.toString() });
    res.json({ message: 'Order marked delivered', patient: publicPatient(p) });
  } catch (err) { next(err); }
};

/* ────────────────────────────────────────────────────────────────── */
/* Admin - list all batches (with populated orders)                  */
/* GET /billing/admin/batches?status=all|submitted|paid|cancelled    */
/* ────────────────────────────────────────────────────────────────── */
export const adminListBatches = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;

    const rows = await BillingBatch.find(filter)
      .sort({ submittedAt: -1 })
      .limit(500)
      .populate('orderIds', 'name systemNumber lensType billing billingStatus')
      .lean();

    res.json(rows);
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Admin - batch action: mark paid OR revert to submitted            */
/* POST /billing/admin/batches/:id/action                            */
/* Body: { action: 'paid' | 'revert' }                               */
/*                                                                    */
/* IMPORTANT: 'paid' flips every non-delivered order to paid;        */
/* 'revert' flips every non-delivered order back to submitted.       */
/* This keeps the batch and its orders perfectly in sync.            */
/* ────────────────────────────────────────────────────────────────── */
export const adminBatchAction = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const { action } = req.body || {};
    const batch = await BillingBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (batch.status === 'cancelled') {
      return res.status(400).json({ message: 'Cancelled batches cannot be modified' });
    }

    if (action === 'paid') {
      if (batch.status !== 'submitted') {
        return res.status(400).json({ message: 'Only submitted batches can be marked paid' });
      }
      batch.status = 'paid';
      batch.paidAt = new Date();
      batch.paidBy = req.user._id;
      batch.paidByName = req.user.name;
      await batch.save();

      await Patient.updateMany(
        { _id: { $in: batch.orderIds }, billingStatus: { $ne: 'delivered' } },
        {
          $set: {
            billingStatus: 'paid',
            'billing.paidAt': new Date(),
            'billing.paidBy': req.user._id,
            'billing.paidByName': req.user.name,
          },
        }
      );

      await writeAudit(req, {
        action: 'billing.admin_batch_paid',
        resource: 'BillingBatch',
        resourceId: batch._id.toString(),
        meta: { batchNumber: batch.batchNumber },
      });
      return res.json({ message: 'Batch marked paid' });
    }

    if (action === 'revert') {
      if (batch.status !== 'paid') {
        return res.status(400).json({ message: 'Only paid batches can be reverted' });
      }
      batch.status = 'submitted';
      batch.paidAt = null;
      batch.paidBy = null;
      batch.paidByName = null;
      await batch.save();

      await Patient.updateMany(
        { _id: { $in: batch.orderIds }, billingStatus: { $ne: 'delivered' } },
        {
          $set: {
            billingStatus: 'submitted_to_director',
            'billing.paidAt': null,
            'billing.paidBy': null,
            'billing.paidByName': null,
          },
        }
      );

      await writeAudit(req, {
        action: 'billing.admin_batch_revert',
        resource: 'BillingBatch',
        resourceId: batch._id.toString(),
        meta: { batchNumber: batch.batchNumber },
      });
      return res.json({ message: 'Batch reverted to submitted' });
    }

    return res.status(400).json({ message: 'Unknown action' });
  } catch (err) {
    next(err);
  }
};


/* ────────────────────────────────────────────────────────────────── */
/* Undelivered - submitted or paid, but not yet delivered             */
/* ────────────────────────────────────────────────────────────────── */
export const listUndelivered = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { q } = req.query;
    const UNDELIVERED_STATUSES = ['submitted_to_director', 'paid'];

    const orderFilter = { billingStatus: { $in: UNDELIVERED_STATUSES } };
    if (q) {
      orderFilter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { systemNumber: { $regex: q, $options: 'i' } },
        { lensType: { $regex: q, $options: 'i' } },
        { frameCode: { $regex: q, $options: 'i' } },
      ];
    }
    const orders = await Patient.find(orderFilter).sort({ updatedAt: -1 }).lean();

    const batchDocs = await BillingBatch.find({
      status: { $in: ['submitted', 'paid'] },
    })
      .sort({ submittedAt: -1 })
      .populate('orderIds', 'name systemNumber lensType billing billingStatus scheme')
      .lean();

    const liveBatches = batchDocs
      .map((b) => {
        const outstanding = (b.orderIds || []).filter(
          (o) => o && UNDELIVERED_STATUSES.includes(o.billingStatus)
        );
        return {
          _id: b._id,
          batchNumber: b.batchNumber,
          status: b.status,
          submittedAt: b.submittedAt,
          submittedByName: b.submittedByName || '',
          ordersTotal: b.ordersTotal || 0,
          fargoAmount: b.fargoAmount || 0,
          grandTotal: b.grandTotal || 0,
          totalOrders: (b.orderIds || []).length,
          outstandingOrders: outstanding.length,
          outstandingOrderIds: outstanding.map((o) => o._id),
          orders: outstanding.map((o) => ({
            _id: o._id,
            name: o.name,
            systemNumber: o.systemNumber,
            lensType: o.lensType,
            scheme: o.scheme || '',
            billingStatus: o.billingStatus,
            total: o.billing?.total ?? 0,
          })),
        };
      })
      .filter((b) => b.outstandingOrders > 0);

    const batchedIds = new Set(
      batchDocs.flatMap((b) => (b.orderIds || []).map((o) => String(o?._id)))
    );
    const individual = orders
      .filter((o) => !o.billing?.batchId && !batchedIds.has(String(o._id)))
      .map((p, i) => publicPatient({ ...p, index: i + 1 }));

    const summary = {
      totalUndeliveredOrders:
        liveBatches.reduce((s, b) => s + b.outstandingOrders, 0) + individual.length,
      totalLiveBatches: liveBatches.length,
      totalIndividual: individual.length,
      totalValue:
        liveBatches.reduce((s, b) => s + b.grandTotal, 0) +
        individual.reduce((s, o) => s + (o.billing?.total || 0), 0),
    };

    res.json({ batches: liveBatches, individual, summary });
  } catch (err) {
    next(err);
  }
};

export const deliverBatch = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const batch = await BillingBatch.findById(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    if (!['submitted', 'paid'].includes(batch.status)) {
      return res.status(400).json({ message: 'Only submitted or paid batches can be delivered' });
    }

    const orders = await Patient.find({
      _id: { $in: batch.orderIds },
      billingStatus: { $in: ['submitted_to_director', 'paid'] },
    });
    if (orders.length === 0) {
      return res.status(400).json({ message: 'No undelivered orders left in this batch' });
    }

    const now = new Date();
    await Patient.updateMany(
      { _id: { $in: orders.map((o) => o._id) } },
      {
        $set: {
          billingStatus: 'delivered',
          orderDelivered: true,
          deliveredAt: now,
          deliveredBy: req.user._id,
          deliveredByName: req.user.name,
        },
      }
    );

    await writeAudit(req, {
      action: 'billing.batch_deliver',
      resource: 'BillingBatch',
      resourceId: batch._id.toString(),
      meta: { batchNumber: batch.batchNumber, deliveredCount: orders.length },
    });

    res.json({
      message: `Delivered ${orders.length} order(s) in batch ${batch.batchNumber}`,
      deliveredCount: orders.length,
    });
  } catch (err) {
    next(err);
  }
};

export const deliverIndividual = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus === 'delivered') {
      return res.status(400).json({ message: 'Already delivered' });
    }
    if (!['submitted_to_director', 'paid'].includes(p.billingStatus)) {
      return res.status(400).json({
        message: 'Only submitted or paid orders can be delivered',
      });
    }

    p.billingStatus = 'delivered';
    p.orderDelivered = true;
    p.deliveredAt = p.deliveredAt || new Date();
    p.deliveredBy = req.user._id;
    p.deliveredByName = req.user.name;
    await p.save();

    await writeAudit(req, {
      action: 'billing.individual_deliver',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { systemNumber: p.systemNumber },
    });

    res.json({ message: 'Order marked delivered', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};