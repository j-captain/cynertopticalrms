import Patient from '../models/Patient.js';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { writeAudit } from '../middleware/audit.js';
import { sendNewOrderToOptician, sendBillToDirector } from '../utils/mailer.js';

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
      ];
    }
    const rows = await Patient.find(filter).sort({ updatedAt: -1 }).lean();
    res.json(rows.map((p, i) => publicPatient({ ...p, index: i + 1 })));
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* All - everything optician has submitted a bill for                */
/* ────────────────────────────────────────────────────────────────── */
export const allOrdersForOptician = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { q } = req.query;
    const filter = { billingStatus: { $in: ['billed', 'paid', 'delivered'] } };
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
/* Order amount summary for optician                                 */
/* ────────────────────────────────────────────────────────────────── */
export const opticianSummary = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const [pending, billed, paid, delivered] = await Promise.all([
      Patient.countDocuments({ billingStatus: 'pending_billing' }),
      Patient.countDocuments({ billingStatus: 'billed' }),
      Patient.countDocuments({ billingStatus: 'paid' }),
      Patient.countDocuments({ billingStatus: 'delivered' }),
    ]);
    const pendingAgg = await Patient.aggregate([
      { $match: { billingStatus: 'pending_billing' } },
      { $group: { _id: null, lens: { $sum: '$lensAmount' }, frame: { $sum: '$frameAmount' } } },
    ]);
    const billedAgg = await Patient.aggregate([
      { $match: { billingStatus: { $in: ['billed', 'paid', 'delivered'] } } },
      { $group: { _id: null, total: { $sum: '$billing.total' } } },
    ]);
    const p = pendingAgg[0] || { lens: 0, frame: 0 };
    const b = billedAgg[0] || { total: 0 };
    res.json({
      pendingCount: pending,
      billedCount: billed,
      paidCount: paid,
      deliveredCount: delivered,
      pendingLensTotal: p.lens,
      pendingFrameTotal: p.frame,
      pendingTotal: (p.lens || 0) + (p.frame || 0),
      billedTotal: b.total,
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Submit bill (optician)                                            */
/* ────────────────────────────────────────────────────────────────── */
export const submitBill = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }

    const { id } = req.params;
    const {
      lenses = 0, frame = 0, fitting = 0, caseAmount = 0, fargo = 0,
    } = req.body || {};

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
      fargo: n(fargo),
    };
    bill.total = bill.lenses + bill.frame + bill.fitting + bill.caseAmount + bill.fargo;

    p.billing = {
      ...bill,
      billedBy: req.user._id,
      billedByName: req.user.name,
      billedAt: new Date(),
    };
    p.billingStatus = 'billed';
    await p.save();

    // Notify director
    try {
      if (env.DIRECTOR_EMAIL) {
        await sendBillToDirector({
          to: env.DIRECTOR_EMAIL,
          patient: p,
          opticianName: req.user.name,
        });
      }
    } catch (e) {
      console.error('Director bill email failed:', e.message);
    }

    await writeAudit(req, {
      action: 'billing.submit',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { total: bill.total },
    });

    res.json({ message: 'Bill submitted', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Deliver (optician)                                                */
/* ────────────────────────────────────────────────────────────────── */
export const deliverOrder = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { id } = req.params;
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus === 'pending_billing') {
      return res.status(400).json({ message: 'Cannot deliver an unbilled order' });
    }
    if (p.billingStatus === 'delivered') {
      return res.status(400).json({ message: 'Already delivered' });
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
/* Director - bills overview                                         */
/* ────────────────────────────────────────────────────────────────── */
export const directorOrders = async (req, res, next) => {
  try {
    if (!requireRole(req, ['director', 'admin'])) {
      return res.status(403).json({ message: 'Director or admin only' });
    }
    const { q, status } = req.query;
    const filter = {};
    if (status === 'paid') filter.billingStatus = { $in: ['paid', 'delivered'] };
    else if (status === 'unpaid') filter.billingStatus = 'billed';
    else if (status === 'all') filter.billingStatus = { $in: ['billed', 'paid', 'delivered'] };
    else filter.billingStatus = { $in: ['billed', 'paid', 'delivered'] };

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

export const directorSummary = async (req, res, next) => {
  try {
    if (!requireRole(req, ['director', 'admin'])) {
      return res.status(403).json({ message: 'Director or admin only' });
    }
    const [newOrders, billed, paid, delivered] = await Promise.all([
      Patient.countDocuments({ billingStatus: 'billed' }),
      Patient.countDocuments({ billingStatus: 'billed' }),
      Patient.countDocuments({ billingStatus: 'paid' }),
      Patient.countDocuments({ billingStatus: 'delivered' }),
    ]);
    const unpaidAgg = await Patient.aggregate([
      { $match: { billingStatus: 'billed' } },
      { $group: { _id: null, total: { $sum: '$billing.total' } } },
    ]);
    const paidAgg = await Patient.aggregate([
      { $match: { billingStatus: { $in: ['paid', 'delivered'] } } },
      { $group: { _id: null, total: { $sum: '$billing.total' } } },
    ]);
    res.json({
      newOrders,
      billed,
      paid,
      delivered,
      unpaidTotal: (unpaidAgg[0] || {}).total || 0,
      paidTotal: (paidAgg[0] || {}).total || 0,
    });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Mark paid (director)                                              */
/* ────────────────────────────────────────────────────────────────── */
export const markPaid = async (req, res, next) => {
  try {
    if (!requireRole(req, ['director', 'admin'])) {
      return res.status(403).json({ message: 'Director or admin only' });
    }
    const { id } = req.params;
    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'billed') {
      return res.status(400).json({ message: 'Only billed orders can be marked paid' });
    }
    p.billingStatus = 'paid';
    p.billing = p.billing || {};
    p.billing.paidAt = new Date();
    p.billing.paidBy = req.user._id;
    p.billing.paidByName = req.user.name;
    await p.save();

    await writeAudit(req, {
      action: 'billing.mark_paid',
      resource: 'Patient',
      resourceId: p._id.toString(),
    });

    res.json({ message: 'Marked as paid', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};


/* ────────────────────────────────────────────────────────────────── */
/* Admin billing overview - read-only, sees everything               */
/* ────────────────────────────────────────────────────────────────── */
export const adminBillingOverview = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }

    const { q, status } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.billingStatus = status;
    }

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
/* Admin billing summary - counts + totals per status                */
/* ────────────────────────────────────────────────────────────────── */
export const adminBillingSummary = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }

    const [pending, billed, paid, delivered] = await Promise.all([
      Patient.countDocuments({ billingStatus: 'pending_billing' }),
      Patient.countDocuments({ billingStatus: 'billed' }),
      Patient.countDocuments({ billingStatus: 'paid' }),
      Patient.countDocuments({ billingStatus: 'delivered' }),
    ]);

    const totalAgg = await Patient.aggregate([
      { $match: { billingStatus: { $in: ['billed', 'paid', 'delivered'] } } },
      {
        $group: {
          _id: null,
          billedTotal: {
            $sum: {
              $cond: [{ $eq: ['$billingStatus', 'billed'] }, '$billing.total', 0],
            },
          },
          paidTotal: {
            $sum: {
              $cond: [
                { $in: ['$billingStatus', ['paid', 'delivered']] },
                '$billing.total',
                0,
              ],
            },
          },
          allTotal: { $sum: '$billing.total' },
        },
      },
    ]);

    const t = totalAgg[0] || { billedTotal: 0, paidTotal: 0, allTotal: 0 };

    res.json({
      pendingCount: pending,
      billedCount: billed,
      paidCount: paid,
      deliveredCount: delivered,
      billedTotal: t.billedTotal,
      paidTotal: t.paidTotal,
      grandTotal: t.allTotal,
    });
  } catch (err) {
    next(err);
  }
};


/* ────────────────────────────────────────────────────────────────── */
/* Admin - bill (same shape as optician submitBill)                  */
/* ────────────────────────────────────────────────────────────────── */
export const adminBillOrder = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const { id } = req.params;
    const {
      lenses = 0, frame = 0, fitting = 0, caseAmount = 0, fargo = 0,
    } = req.body || {};

    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'pending_billing') {
      return res.status(400).json({ message: 'This order is not pending billing. Use Edit instead.' });
    }

    const n = (v) => Math.max(0, Number(v) || 0);
    const bill = {
      lenses: n(lenses),
      frame: n(frame),
      fitting: n(fitting),
      caseAmount: n(caseAmount),
      fargo: n(fargo),
    };
    bill.total = bill.lenses + bill.frame + bill.fitting + bill.caseAmount + bill.fargo;

    p.billing = {
      ...bill,
      billedBy: req.user._id,
      billedByName: req.user.name,
      billedAt: new Date(),
    };
    p.billingStatus = 'billed';
    await p.save();

    await writeAudit(req, {
      action: 'billing.admin_bill',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { total: bill.total },
    });

    res.json({ message: 'Bill submitted', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Admin - edit an existing bill (any status: billed / paid / delivered) */
/* ────────────────────────────────────────────────────────────────── */
export const adminEditBill = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const { id } = req.params;
    const {
      lenses = 0, frame = 0, fitting = 0, caseAmount = 0, fargo = 0,
    } = req.body || {};

    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus === 'pending_billing') {
      return res.status(400).json({ message: 'Order is not billed yet. Use Bill instead.' });
    }

    const n = (v) => Math.max(0, Number(v) || 0);
    const bill = {
      lenses: n(lenses),
      frame: n(frame),
      fitting: n(fitting),
      caseAmount: n(caseAmount),
      fargo: n(fargo),
    };
    bill.total = bill.lenses + bill.frame + bill.fitting + bill.caseAmount + bill.fargo;

    // Preserve the original billedBy / billedAt metadata
    const prev = p.billing || {};
    p.billing = {
      ...prev,
      ...bill,
      // If it was already billed, keep the original biller/date.
      // If it was pending (shouldn't happen here - guarded), stamp it now.
      billedBy: prev.billedBy || req.user._id,
      billedByName: prev.billedByName || req.user.name,
      billedAt: prev.billedAt || new Date(),
    };

    await p.save();

    await writeAudit(req, {
      action: 'billing.admin_edit',
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
/* Admin - revert to pending (clear the bill)                        */
/* ────────────────────────────────────────────────────────────────── */
export const adminRevertToPending = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });

    const previousStatus = p.billingStatus;
    p.billingStatus = 'pending_billing';
    p.billing = undefined;
    p.deliveredBy = undefined;
    p.deliveredByName = undefined;
    p.orderDelivered = false;
    p.deliveredAt = undefined;
    await p.save({ validateBeforeSave: false });

    await writeAudit(req, {
      action: 'billing.admin_revert',
      resource: 'Patient',
      resourceId: p._id.toString(),
      meta: { previousStatus },
    });

    res.json({ message: 'Reverted to pending', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Admin - set paid (from billed)                                    */
/* ────────────────────────────────────────────────────────────────── */
export const adminMarkPaid = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'billed') {
      return res.status(400).json({ message: 'Only billed orders can be marked paid' });
    }

    p.billingStatus = 'paid';
    p.billing = p.billing || {};
    p.billing.paidAt = new Date();
    p.billing.paidBy = req.user._id;
    p.billing.paidByName = req.user.name;
    await p.save();

    await writeAudit(req, {
      action: 'billing.admin_mark_paid',
      resource: 'Patient',
      resourceId: p._id.toString(),
    });

    res.json({ message: 'Marked as paid', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Admin - revert paid back to billed                                */
/* ────────────────────────────────────────────────────────────────── */
export const adminRevertToBilled = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'paid') {
      return res.status(400).json({ message: 'Only paid orders can be reverted to billed' });
    }

    p.billingStatus = 'billed';
    if (p.billing) {
      p.billing.paidAt = undefined;
      p.billing.paidBy = undefined;
      p.billing.paidByName = undefined;
    }
    await p.save();

    await writeAudit(req, {
      action: 'billing.admin_revert_billed',
      resource: 'Patient',
      resourceId: p._id.toString(),
    });

    res.json({ message: 'Reverted to billed', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Admin - deliver (from paid)                                       */
/* ────────────────────────────────────────────────────────────────── */
export const adminDeliver = async (req, res, next) => {
  try {
    if (!requireRole(req, ['admin'])) {
      return res.status(403).json({ message: 'Admin only' });
    }
    const p = await Patient.findById(req.params.id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus === 'delivered') {
      return res.status(400).json({ message: 'Already delivered' });
    }
    if (p.billingStatus === 'pending_billing') {
      return res.status(400).json({ message: 'Cannot deliver an unbilled order' });
    }

    p.billingStatus = 'delivered';
    p.orderDelivered = true;
    p.deliveredAt = p.deliveredAt || new Date();
    p.deliveredBy = req.user._id;
    p.deliveredByName = req.user.name;
    await p.save();

    await writeAudit(req, {
      action: 'billing.admin_deliver',
      resource: 'Patient',
      resourceId: p._id.toString(),
    });

    res.json({ message: 'Order marked delivered', patient: publicPatient(p) });
  } catch (err) {
    next(err);
  }
};

/* ────────────────────────────────────────────────────────────────── */
/* Optician - Billed but not delivered (new queue page)              */
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
/* Optician - Edit a bill (billed → billed, only adjusts amounts)    */
/*                                                                    */
/* Same shape as adminEditBill but allows optician (their own bill)  */
/* to fix typos without a full admin round-trip.                      */
/* Does NOT allow reverting to pending - that stays with admin.       */
/* ────────────────────────────────────────────────────────────────── */
export const opticianEditBill = async (req, res, next) => {
  try {
    if (!requireRole(req, ['optician', 'admin'])) {
      return res.status(403).json({ message: 'Optician or admin only' });
    }
    const { id } = req.params;
    const {
      lenses = 0, frame = 0, fitting = 0, caseAmount = 0, fargo = 0,
    } = req.body || {};

    const p = await Patient.findById(id);
    if (!p) return res.status(404).json({ message: 'Patient not found' });
    if (p.billingStatus !== 'billed') {
      return res.status(400).json({
        message: 'Only orders in "billed" status can be edited by optician',
      });
    }

    const n = (v) => Math.max(0, Number(v) || 0);
    const bill = {
      lenses: n(lenses),
      frame: n(frame),
      fitting: n(fitting),
      caseAmount: n(caseAmount),
      fargo: n(fargo),
    };
    bill.total = bill.lenses + bill.frame + bill.fitting + bill.caseAmount + bill.fargo;

    const prev = p.billing || {};
    p.billing = {
      ...prev,
      ...bill,
      // preserve original biller / date
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