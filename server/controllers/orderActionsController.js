import Patient from '../models/Patient.js';
import OrderLog from '../models/OrderLog.js';
import { sendOrderEmail } from '../utils/mailer.js';
import { writeAudit } from '../middleware/audit.js';

export const resendOrder = async (req, res, next) => {
  try {
    const { logId } = req.params;
    const log = await OrderLog.findById(logId);
    if (!log) return res.status(404).json({ message: 'Order log not found' });
    const patient = await Patient.findById(log.patient);
    if (!patient) return res.status(404).json({ message: 'Patient no longer exists' });

    const { recipientEmail, emailMode } = req.body || {};

    // Prefer explicit recipient > this log's recipient > last successful
    // recipient > first recipient. This avoids the "empty recipientEmail +
    // empty log.recipientEmail → 400" edge case.
    let recipient = recipientEmail?.trim();
    if (!recipient) recipient = log.recipientEmail;
    if (!recipient) {
      const prior = await OrderLog
        .findOne({ patient: patient._id, recipientEmail: { $nin: [null, ''] } })
        .sort({ createdAt: -1 })
        .lean();
      recipient = prior?.recipientEmail || '';
    }
    if (!/^\S+@\S+\.\S+$/.test(recipient)) {
      return res.status(400).json({ message: 'No valid recipient email available' });
    }

    const mode =
      emailMode === 'mini' ? 'mini'
      : emailMode === 'full' ? 'full'
      : (log.emailMode || 'full');

    let status = 'sent';
    let errorMsg;
    try {
      await sendOrderEmail({ to: recipient, patient, mode });
    } catch (e) {
      status = 'failed';
      errorMsg = e.message;
    }

    const newLog = await OrderLog.create({
      patient: patient._id,
      patientName: patient.name,
      systemNumber: patient.systemNumber,
      lensType: patient.lensType,
      rxBe: patient.rxBe,
      rxAdd: patient.rxAdd,
      rxPd: patient.rxPd,
      diagnoses: patient.diagnoses || [],
      complaint: patient.complaint,
      scheme: patient.scheme,
      insurance: patient.insurance,
      lensAmount: patient.lensAmount,
      frameCode: patient.frameCode,
      frameAmount: patient.frameAmount,
      totalAmount: (patient.lensAmount || 0) + (patient.frameAmount || 0),
      recipientEmail: recipient,
      sentBy: req.user?._id,
      sentByName: req.user?.name,
      status,
      emailMode: mode,
      error: errorMsg,
    });

    // Bump durable resend counter only on a successful send.
    if (status === 'sent') {
      patient.resendCount = (Number(patient.resendCount) || 0) + 1;
      // Keep orderPlaced/submissionDate consistent - a resend means the
      // order is definitely placed.
      patient.orderPlaced = true;
      if (!patient.submissionDate) patient.submissionDate = new Date();
      if (!patient.orderedAt) patient.orderedAt = new Date();
      await patient.save();
    }

    await writeAudit(req, {
      action: 'order.resend',
      resource: 'OrderLog',
      resourceId: newLog._id.toString(),
      status,
      meta: { recipient, mode },
    });

    if (status === 'failed') {
      return res.status(502).json({ message: 'Resend failed', detail: errorMsg });
    }
    res.json({ message: 'Email resent', log: newLog });
  } catch (err) {
    next(err);
  }
};

export const cancelOrder = async (req, res, next) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (!patient.orderPlaced) {
      return res.status(400).json({ message: 'Order is not placed' });
    }
    if (patient.orderDelivered) {
      return res.status(400).json({ message: 'Cannot cancel a delivered order' });
    }
    patient.orderPlaced = false;
    patient.orderedAt = null;
    patient.orderedBy = null;
    // resendCount stays - a cancelled order was still resubmitted in the past
    // and reports should keep that history. Re-submitting after a cancel
    // will naturally count as a new resend via submitOrder.
    await patient.save();

    await writeAudit(req, {
      action: 'order.cancel',
      resource: 'Patient',
      resourceId: patient._id.toString(),
    });
    res.json({ message: 'Order cancelled', patient });
  } catch (err) {
    next(err);
  }
};

export const listOrders = async (req, res, next) => {
  try {
    const { from, to, status, q } = req.query;
    const filter = {};
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    if (status && status !== 'all') filter.status = status;
    if (q) {
      filter.$or = [
        { patientName: { $regex: q, $options: 'i' } },
        { systemNumber: { $regex: q, $options: 'i' } },
        { recipientEmail: { $regex: q, $options: 'i' } },
      ];
    }
    const orders = await OrderLog.find(filter).sort({ createdAt: -1 }).limit(1000).lean();
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

export const orderStats = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const match = {};
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to) match.createdAt.$lte = new Date(to);
    }
    const logs = await OrderLog.aggregate([{ $match: match }]);

    const sent = logs.filter((l) => l.status === 'sent');
    const failed = logs.filter((l) => l.status === 'failed');
    const totalValue = sent.reduce((s, l) => s + (l.totalAmount || 0), 0);

    const byDay = {};
    logs.forEach((l) => {
      const d = new Date(l.createdAt).toISOString().slice(0, 10);
      if (!byDay[d]) byDay[d] = { date: d, sent: 0, failed: 0, value: 0 };
      if (l.status === 'sent') {
        byDay[d].sent++;
        byDay[d].value += l.totalAmount || 0;
      } else {
        byDay[d].failed++;
      }
    });

    res.json({
      total: logs.length,
      sent: sent.length,
      failed: failed.length,
      totalValue,
      daily: Object.values(byDay).sort((a, b) => (a.date > b.date ? 1 : -1)),
    });
  } catch (err) {
    next(err);
  }
};