import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.resolve(process.cwd(), 'uploads', 'patients');

// Ensure the base dir exists
fs.mkdirSync(ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const patientId = req.params.id;
    const dir = path.join(ROOT, patientId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // kind comes from the query string (?kind=prescription | diagnostic)
    const kind = (req.query.kind || 'file').toLowerCase();
    const safeKind = ['prescription', 'diagnostic'].includes(kind) ? kind : 'file';
    cb(null, `${safeKind}.pdf`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype !== 'application/pdf') {
    return cb(new Error('Only PDF files are allowed'));
  }
  cb(null, true);
};

export const uploadPdf = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('file');