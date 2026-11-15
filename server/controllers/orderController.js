import Patient from '../models/Patient.js';
import OrderLog from '../models/OrderLog.js';
import Settings from '../models/Settings.js';
import { sendOrderEmail, sendNewOrderToOptician } from '../utils/mailer.js';
import { env } from '../config/env.js';
import { writeAudit } from '../middleware/audit.js';

export const submitOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recipientEmail, sendToDefault, emailMode } = req.body;
    const mode = emailMode === 'mini' ? 'mini' : 'full';

    const patient = await Patient.findById(id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const settings = await Settings.getSingleton();
    const defaultRecipient =
      settings.orderRecipientEmail || env.ORDER_RECIPIENT_EMAIL || '';

    const targetEmail = sendToDefault
      ? defaultRecipient
      : recipientEmail?.trim();

    if (!targetEmail || !/^\S+@\S+\.\S+$/.test(targetEmail)) {
      return res.status(400).json({
        message: sendToDefault
          ? 'No default recipient configured. Ask an admin to set one in Settings.'
          : 'A valid recipient email is required',
      });
    }

    const wasAlreadyPlaced = !!patient.orderPlaced;

    let status = 'sent';
    let errorMsg;
    try {
      const result = await sendOrderEmail({ to: targetEmail, patient, mode });
      if (result?.simulated) console.log('📧 Simulated email (SMTP not configured)');
    } catch (e) {
      status = 'failed';
      errorMsg = e.message;
      console.error('Email send failed:', e.message);
    }

    if (status === 'sent') {
      const now = new Date();
      patient.orderPlaced = true;
      patient.orderedAt = now;
      patient.submissionDate = now;
      patient.orderedBy = req.user?._id;

      // Resubmit counter (durable).
      if (wasAlreadyPlaced) {
        patient.resendCount = (Number(patient.resendCount) || 0) + 1;
      }

      // Reset billing on every submit so the optician re-bills this order.
      // A fresh submit means the previous bill (if any) is no longer valid.
      patient.billingStatus = 'pending_billing';
      patient.billing = undefined;
      patient.deliveredBy = undefined;
      patient.deliveredByName = undefined;
      patient.orderDelivered = false;
      patient.deliveredAt = undefined;

      await patient.save();
    }

    const log = await OrderLog.create({
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
      recipientEmail: targetEmail,
      sentBy: req.user?._id,
      sentByName: req.user?.name,
      status,
      emailMode: mode,
      error: errorMsg,
    });

    await writeAudit(req, {
      action: 'order.submit',
      resource: 'OrderLog',
      resourceId: log._id.toString(),
      status,
      meta: { patientId: patient._id.toString(), recipient: targetEmail, mode },
    });

    if (status === 'failed')
      return res.status(502).json({ message: 'Email delivery failed', detail: errorMsg });

    // Notify the optician that a new order is waiting to be billed.
    // Best-effort: a mail failure must not break the submit response.
    if (env.OPTICIAN_EMAIL) {
      try {
        await sendNewOrderToOptician({
          to: env.OPTICIAN_EMAIL,
          patient,
          staffName: req.user?.name,
        });
      } catch (e) {
        console.error('Optician notification failed:', e.message);
      }
    }

    res.json({ message: 'Order placed and email sent', patient });
  } catch (err) {
    next(err);
  }
};

export const listOrderLogs = async (req, res, next) => {
  try {
    const logs = await OrderLog.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json(logs);
  } catch (err) {
    next(err);
  }
};