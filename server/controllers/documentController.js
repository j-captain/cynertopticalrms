import Patient from '../models/Patient.js';

// List every patient with at least one document
export const listAllDocuments = async (req, res, next) => {
  try {
    const { q } = req.query;
    const filter = { 'documents.0': { $exists: true } };

    if (q) {
      filter.$or = [
        { name: { $regex: q, $options: 'i' } },
        { systemNumber: { $regex: q, $options: 'i' } },
      ];
    }

    const patients = await Patient.find(filter)
      .select('name systemNumber scheme insurance documents totalAmount orderPlaced submissionDate lensAmount frameAmount')
      .sort({ updatedAt: -1 })
      .lean();

    const rows = patients.map((p) => ({
      _id: p._id,
      name: p.name,
      systemNumber: p.systemNumber,
      scheme: p.scheme || '',
      insurance: p.insurance || '',
      orderPlaced: !!p.orderPlaced,
      submissionDate: p.submissionDate || null,
      documents: (p.documents || []).map((d) => ({
        kind: d.kind,
        filename: d.filename,
        originalName: d.originalName,
        size: d.size,
        uploadedAt: d.uploadedAt,
      })),
    }));

    const summary = {
      totalPatients: rows.length,
      totalDocs: rows.reduce((s, r) => s + r.documents.length, 0),
      prescriptions: rows.reduce(
        (s, r) => s + r.documents.filter((d) => d.kind === 'prescription').length,
        0
      ),
      diagnostics: rows.reduce(
        (s, r) => s + r.documents.filter((d) => d.kind === 'diagnostic').length,
        0
      ),
    };

    res.json({ rows, summary });
  } catch (err) {
    next(err);
  }
};