import mongoose from 'mongoose';
import { writeAudit } from '../middleware/audit.js';

// ─── Whitelist ───
// Only these collections can be touched. Blocks system / _internal names.
const ALLOWED = [
  'users',
  'patients',
  'orderlogs',
  'settings',
  'auditlogs',
  'icd11codes',
  'insurances',
  'customrecipients',
];

const HUMAN_NAMES = {
  users: 'Users',
  patients: 'Patients',
  orderlogs: 'Order Logs',
  settings: 'Settings',
  auditlogs: 'Audit Logs',
  icd11codes: 'ICD-11 Codes',
  insurances: 'Insurances',
  customrecipients: 'Custom Recipients',
};

const PROTECTED = {
  users: 'Cannot modify the Users collection directly - use the Users page.',
};

const guard = (name) => {
  if (!ALLOWED.includes(name)) throw new Error(`Collection "${name}" is not allowed`);
};

// ─── List collections with stats ───
export const listCollections = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const existing = await db.listCollections().toArray();
    const existingNames = new Set(existing.map((c) => c.name));

    const collections = await Promise.all(
      ALLOWED.map(async (name) => {
        const exists = existingNames.has(name);
        let count = 0;
        let sizeBytes = 0;
        let indexCount = 0;
        if (exists) {
          try {
            const stats = await db.command({ collStats: name });
            count = stats.count || 0;
            sizeBytes = stats.size || 0;
            indexCount = stats.nindexes || 0;
          } catch {
            count = 0;
          }
        }
        return {
          name,
          displayName: HUMAN_NAMES[name] || name,
          exists,
          count,
          sizeBytes,
          indexCount,
          protected: !!PROTECTED[name],
          protectedReason: PROTECTED[name] || null,
        };
      })
    );

    // DB-level stats
    let dbStats = { dataSize: 0, storageSize: 0, collections: existing.length };
    try {
      const s = await db.stats();
      dbStats = {
        dataSize: s.dataSize || 0,
        storageSize: s.storageSize || 0,
        collections: s.collections || existing.length,
        documents: s.objects || 0,
        indexes: s.indexes || 0,
      };
    } catch {}

    res.json({
      collections,
      dbName: mongoose.connection.name,
      dbStats,
      host: mongoose.connection.host,
      readyState: mongoose.connection.readyState,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Export one collection ───
export const exportCollection = async (req, res, next) => {
  try {
    const { name } = req.params;
    guard(name);

    const docs = await mongoose.connection.db.collection(name).find({}).toArray();

    await writeAudit(req, {
      action: 'db.export',
      resource: 'Collection',
      resourceId: name,
      meta: { count: docs.length },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.json"`
    );
    res.send(JSON.stringify(docs, null, 2));
  } catch (err) {
    next(err);
  }
};

// ─── Export everything in one file ───
export const exportAll = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const payload = {
      exportedAt: new Date().toISOString(),
      dbName: mongoose.connection.name,
      collections: {},
    };

    for (const name of ALLOWED) {
      try {
        payload.collections[name] = await db.collection(name).find({}).toArray();
      } catch {
        payload.collections[name] = [];
      }
    }

    await writeAudit(req, {
      action: 'db.export_all',
      resource: 'Database',
      resourceId: mongoose.connection.name,
      meta: {
        collections: Object.keys(payload.collections).length,
        totalDocs: Object.values(payload.collections).reduce((s, a) => s + a.length, 0),
      },
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cynert-full-backup-${new Date().toISOString().slice(0, 10)}.json"`
    );
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    next(err);
  }
};

// ─── Empty a collection ───
export const emptyCollection = async (req, res, next) => {
  try {
    const { name } = req.params;
    guard(name);

    if (PROTECTED[name]) {
      return res.status(400).json({ message: PROTECTED[name] });
    }

    if (name === 'users') {
      const currentUserId = req.user?._id?.toString();
      const otherAdmins = await mongoose.connection.db
        .collection('users')
        .countDocuments({
          role: 'admin',
          _id: { $ne: new mongoose.Types.ObjectId(currentUserId) },
        });
      if (otherAdmins === 0) {
        return res.status(400).json({
          message: 'Refusing to empty users: you would lose all admin accounts. Create another admin first.',
        });
      }
    }

    const result = await mongoose.connection.db.collection(name).deleteMany({});

    await writeAudit(req, {
      action: 'db.empty',
      resource: 'Collection',
      resourceId: name,
      meta: { deletedCount: result.deletedCount },
    });

    res.json({ message: `Emptied ${name}`, deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
};

// ─── Drop a collection ───
export const dropCollection = async (req, res, next) => {
  try {
    const { name } = req.params;
    guard(name);

    if (PROTECTED[name]) {
      return res.status(400).json({ message: PROTECTED[name] });
    }

    const db = mongoose.connection.db;
    const exists = await db.listCollections({ name }).toArray();
    if (exists.length === 0) {
      return res.status(404).json({ message: `Collection "${name}" does not exist` });
    }

    await db.collection(name).drop();

    await writeAudit(req, {
      action: 'db.drop',
      resource: 'Collection',
      resourceId: name,
    });

    res.json({ message: `Dropped ${name}` });
  } catch (err) {
    next(err);
  }
};

// ─── Restore from JSON ───
// Body: { docs: [...] }  or  { mode: 'replace', docs: [...] }
export const restoreCollection = async (req, res, next) => {
  try {
    const { name } = req.params;
    guard(name);
    const { docs, mode } = req.body || {};

    if (!Array.isArray(docs)) {
      return res.status(400).json({ message: 'Body must contain { docs: [...] }' });
    }

    const db = mongoose.connection.db;
    const col = db.collection(name);

    let inserted = 0;
    let replaced = 0;
    let failed = 0;

    if (mode === 'replace') {
      await col.deleteMany({});
    }

    for (const doc of docs) {
      try {
        if (doc._id) {
          const id = typeof doc._id === 'object' && doc._id.$oid
            ? new mongoose.Types.ObjectId(doc._id.$oid)
            : doc._id;
          const r = await col.replaceOne({ _id: id }, { ...doc, _id: id }, { upsert: true });
          if (r.upsertedCount > 0) inserted++;
          else if (r.modifiedCount > 0) replaced++;
        } else {
          await col.insertOne(doc);
          inserted++;
        }
      } catch {
        failed++;
      }
    }

    await writeAudit(req, {
      action: 'db.restore',
      resource: 'Collection',
      resourceId: name,
      meta: { total: docs.length, inserted, replaced, failed, mode: mode || 'upsert' },
    });

    res.json({
      message: `Restored ${name}`,
      total: docs.length,
      inserted,
      replaced,
      failed,
      mode: mode || 'upsert',
    });
  } catch (err) {
    next(err);
  }
};

// ─── Restore FULL database backup ───
// Body: { collections: { patients: [...], orderlogs: [...], ... }, mode: 'upsert' | 'replace' }
export const restoreAll = async (req, res, next) => {
  try {
    const { collections, mode } = req.body || {};
    if (!collections || typeof collections !== 'object') {
      return res.status(400).json({ message: 'Body must contain { collections: { name: [...] } }' });
    }

    const db = mongoose.connection.db;
    const report = {};

    for (const [name, docs] of Object.entries(collections)) {
      if (!ALLOWED.includes(name)) {
        report[name] = { skipped: true, reason: 'not allowed' };
        continue;
      }
      if (PROTECTED[name]) {
        report[name] = { skipped: true, reason: PROTECTED[name] };
        continue;
      }
      if (!Array.isArray(docs)) {
        report[name] = { skipped: true, reason: 'invalid docs array' };
        continue;
      }

      try {
        const col = db.collection(name);
        let inserted = 0, replaced = 0, failed = 0;
        if (mode === 'replace') await col.deleteMany({});

        for (const doc of docs) {
          try {
            if (doc._id) {
              const id = typeof doc._id === 'object' && doc._id.$oid
                ? new mongoose.Types.ObjectId(doc._id.$oid)
                : doc._id;
              const r = await col.replaceOne({ _id: id }, { ...doc, _id: id }, { upsert: true });
              if (r.upsertedCount > 0) inserted++;
              else if (r.modifiedCount > 0) replaced++;
            } else {
              await col.insertOne(doc);
              inserted++;
            }
          } catch {
            failed++;
          }
        }
        report[name] = { total: docs.length, inserted, replaced, failed };
      } catch (e) {
        report[name] = { error: e.message };
      }
    }

    await writeAudit(req, {
      action: 'db.restore_all',
      resource: 'Database',
      resourceId: mongoose.connection.name,
      meta: { mode: mode || 'upsert', collections: Object.keys(collections) },
    });

    res.json({ message: 'Restore completed', report, mode: mode || 'upsert' });
  } catch (err) {
    next(err);
  }
};

// ─── Health check ───
export const health = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const stats = await db.stats();
    const ping = await db.command({ ping: 1 });
    res.json({
      ok: true,
      ping: ping.ok === 1 ? 'OK' : 'FAIL',
      readyState: mongoose.connection.readyState,
      dbName: mongoose.connection.name,
      host: mongoose.connection.host,
      stats: {
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        collections: stats.collections,
        documents: stats.objects,
        indexes: stats.indexes,
      },
      server: {
        version: mongoose.version,
        nodeVersion: process.version,
      },
    });
  } catch (err) {
    next(err);
  }
};


// ─── View collection contents (paginated) ───
export const viewCollection = async (req, res, next) => {
  try {
    const { name } = req.params;
    guard(name);

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const skip = (page - 1) * limit;

    const col = mongoose.connection.db.collection(name);

    const total = await col.countDocuments({});
    const docs = await col.find({}).skip(skip).limit(limit).toArray();

    // Union of all keys across the page (docs may have different shapes)
    const keysSet = new Set();
    docs.forEach((d) => Object.keys(d).forEach((k) => keysSet.add(k)));
    const keys = Array.from(keysSet);

    res.json({
      name,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
      keys,
      docs,
    });
  } catch (err) {
    next(err);
  }
};