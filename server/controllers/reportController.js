import Patient from '../models/Patient.js';
import OrderLog from '../models/OrderLog.js';

const computeStatus = (p, emailCount) => {
  if (p.orderHandedToClient) return 'handed';
  if (p.orderDelivered) return 'delivered';
  if (emailCount >= 2) return 'resubmitted';
  if (p.orderPlaced) return 'submitted';
  return 'pending';
};

// ─── Dashboard ───
export const dashboardStats = async (req, res, next) => {
  try {
    const [totalPatients, ordered, delivered, handed, logs] = await Promise.all([
      Patient.countDocuments(),
      Patient.countDocuments({ orderPlaced: true }),
      Patient.countDocuments({ orderDelivered: true }),
      Patient.countDocuments({ orderHandedToClient: true }),
      OrderLog.find().lean(),
    ]);

    const patients = await Patient.find().lean();
    const totalRevenue = patients.reduce(
      (s, p) => s + (p.lensAmount || 0) + (p.frameAmount || 0),
      0
    );
    const orderedRevenue = patients
      .filter((p) => p.orderPlaced)
      .reduce((s, p) => s + (p.lensAmount || 0) + (p.frameAmount || 0), 0);

    const sentEmails = logs.filter((l) => l.status === 'sent').length;
    const failedEmails = logs.filter((l) => l.status === 'failed').length;

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const count = logs.filter(
        (l) => new Date(l.createdAt) >= d && new Date(l.createdAt) < next
      ).length;
      days.push({ label: d.toLocaleDateString('en', { weekday: 'short' }), count });
    }

    res.json({
      totalPatients,
      ordered,
      pending: totalPatients - ordered,
      delivered,
      handed,
      totalRevenue,
      orderedRevenue,
      sentEmails,
      failedEmails,
      activity: days,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Orders report ───
export const ordersReport = async (req, res, next) => {
  try {
    const { q, status, from, to } = req.query;

    const patientFilter = {
      $or: [
        { orderPlaced: true },
        { orderDelivered: true },
        { orderHandedToClient: true },
        { submissionDate: { $ne: null } },
      ],
    };
    const patients = await Patient.find(patientFilter).sort({ updatedAt: -1 }).lean();

    // Only SENT logs matter for "was this order actually resubmitted".
    // A failed first attempt never made it out the door and must not count.
    const logs = await OrderLog.find().lean();
    const logsByPatient = {};
    logs.forEach((l) => {
      const k = String(l.patient);
      if (!logsByPatient[k]) logsByPatient[k] = [];
      logsByPatient[k].push(l);
    });

    let rows = patients.map((p, i) => {
      const patientLogs = logsByPatient[String(p._id)] || [];
      const sentLogs = patientLogs.filter((l) => l.status === 'sent');
      const failedLogs = patientLogs.filter((l) => l.status === 'failed');
      const lastLog = [...patientLogs].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      )[0];

      // Resubmission count = durable field on Patient OR extra sent logs
      // beyond the first (self-healing for legacy records that never got
      // the resendCount field written).
      const sentFromLogs = sentLogs.length;
      const durableResendCount = Math.max(0, Number(p.resendCount || 0));
      const derivedResendCount =
        sentFromLogs > 0 ? sentFromLogs - 1 : 0;
      const resendCount = Math.max(durableResendCount, derivedResendCount);
      const totalSends = 1 + resendCount; // 1 submit + N resends

      return {
        _id: p._id,
        index: i + 1,
        patientName: p.name,
        systemNumber: p.systemNumber,
        scheme: p.scheme || '',
        insurance: p.insurance || '',
        lensType: p.lensType,
        rxBe: p.rxBe,
        rxAdd: p.rxAdd,
        rxPd: p.rxPd,
        diagnoses: p.diagnoses || [],
        complaint: p.complaint || '',
        lensAmount: p.lensAmount,
        frameCode: p.frameCode,
        frameAmount: p.frameAmount,
        totalAmount: (p.lensAmount || 0) + (p.frameAmount || 0),
        preAuthDate: p.preAuthDate,
        submissionDate: p.submissionDate,
        orderedAt: p.orderedAt,
        deliveredAt: p.deliveredAt,
        handedAt: p.handedAt,
        orderPlaced: p.orderPlaced,
        orderDelivered: p.orderDelivered,
        orderHandedToClient: p.orderHandedToClient,
        emailSentCount: sentFromLogs,
        emailFailedCount: failedLogs.length,
        resendCount,
        totalSends,
        lastEmailAt: lastLog?.createdAt || null,
        lastEmailStatus: lastLog?.status || null,
        lastEmailTo: lastLog?.recipientEmail || null,
        emailMode: lastLog?.emailMode || 'full',
        status: computeStatus(p, sentFromLogs),
      };
    });

    // Filters
    if (status && status !== 'all') rows = rows.filter((r) => r.status === status);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.patientName?.toLowerCase().includes(needle) ||
          r.systemNumber?.toLowerCase().includes(needle) ||
          r.frameCode?.toLowerCase().includes(needle) ||
          (r.scheme || '').toLowerCase().includes(needle) ||
          (r.insurance || '').toLowerCase().includes(needle) ||
          (r.lensType || '').toLowerCase().includes(needle) ||
          (r.diagnoses || []).some(
            (d) =>
              (d.code || '').toLowerCase().includes(needle) ||
              (d.description || '').toLowerCase().includes(needle)
          )
      );
    }
    if (from || to) {
      const f = from ? new Date(from) : null;
      const t = to ? new Date(to) : null;
      rows = rows.filter((r) => {
        const d = r.submissionDate || r.orderedAt;
        if (!d) return false;
        const dt = new Date(d);
        if (f && dt < f) return false;
        if (t) {
          const end = new Date(t);
          end.setHours(23, 59, 59, 999);
          if (dt > end) return false;
        }
        return true;
      });
    }

    // ─── Summary ───
    // Counts are cumulative milestones, not exclusive statuses.
    const summary = {
      count: rows.length,
      submitted: rows.filter((r) => r.orderPlaced).length,
      // resubmitted = orders that have been resent at least once
      resubmitted: rows.filter((r) => r.resendCount >= 1).length,
      delivered: rows.filter((r) => r.orderDelivered).length,
      handed: rows.filter((r) => r.orderHandedToClient).length,
      pending: rows.filter((r) => !r.orderPlaced).length,
      total: rows.reduce((s, r) => s + (r.totalAmount || 0), 0),
      lens: rows.reduce((s, r) => s + (r.lensAmount || 0), 0),
      frame: rows.reduce((s, r) => s + (r.frameAmount || 0), 0),
      emailsSent: rows.reduce((s, r) => s + r.emailSentCount, 0),
      emailsFailed: rows.reduce((s, r) => s + r.emailFailedCount, 0),
    };

    // ─── Breakdowns ───
    const groupBy = (keyFn) => {
      const map = {};
      for (const r of rows) {
        const key = keyFn(r) || '-';
        if (!map[key]) {
          map[key] = {
            key,
            count: 0,
            submitted: 0,
            resubmitted: 0,
            delivered: 0,
            handed: 0,
            total: 0,
            lens: 0,
            frame: 0,
          };
        }
        const g = map[key];
        g.count += 1;
        if (r.orderPlaced) g.submitted += 1;
        if (r.resendCount >= 1) g.resubmitted += 1;
        if (r.orderDelivered) g.delivered += 1;
        if (r.orderHandedToClient) g.handed += 1;
        g.total += r.totalAmount || 0;
        g.lens += r.lensAmount || 0;
        g.frame += r.frameAmount || 0;
      }
      return Object.values(map).sort((a, b) => b.count - a.count);
    };

    const breakdowns = {
      byLensType: groupBy((r) => r.lensType),
      byScheme: groupBy((r) => r.scheme),
      byInsurance: groupBy((r) =>
        r.scheme === 'Insurance' ? r.insurance || '(unspecified)' : null
      ),
      byStatus: groupBy((r) => r.status),
    };

    res.json({ rows, summary, breakdowns });
  } catch (err) {
    next(err);
  }
};