import { Router } from 'express';
import { body } from 'express-validator';
import {
  listPatients, getPatient, createPatient, updatePatient,
  deletePatient, updateStatus, markSubmitted,
  uploadDocument, downloadDocument, deleteDocument,
} from '../controllers/patientController.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { submitOrder } from '../controllers/orderController.js';
import { uploadPdf } from '../middleware/upload.js';

const router = Router();
router.use(protect);

router.get('/', listPatients);
router.get('/:id', getPatient);

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('systemNumber').trim().notEmpty().withMessage('System number required'),
    body('lensType').trim().notEmpty().withMessage('Lens type required'),
    body('lensAmount').isFloat({ min: 0 }).withMessage('Valid lens amount required'),
    body('frameCode').trim().notEmpty().withMessage('Frame code is required'),
    body('frameAmount').isFloat({ min: 0 }).withMessage('Valid frame amount required'),
    body('rxBe').trim().notEmpty().withMessage('RX BE is required'),
    body('rxPd').trim().notEmpty().withMessage('PD is required'),
    body('rxAdd').optional().trim(),
    body('diagnoses').isArray({ min: 1, max: 5 }).withMessage('Diagnosis 1 is required (max 5)'),
    body('complaint').trim().notEmpty().withMessage('Complaint is required'),
    body('scheme').isIn(['Self-Sponsored (Cash)', 'Insurance']).withMessage('Valid scheme required'),
    body('insurance').if(body('scheme').equals('Insurance')).trim().notEmpty().withMessage('Insurance is required'),
  ],
  createPatient
);

router.put('/:id', updatePatient);
router.patch('/:id/status', updateStatus);
router.post('/:id/mark-submitted', markSubmitted);

// ─── Documents ───
router.post('/:id/documents/upload', uploadPdf, uploadDocument);
router.get('/:id/documents/:kind', downloadDocument);
router.delete('/:id/documents/:kind', deleteDocument);

router.delete('/:id', requireAdmin, deletePatient);

router.post('/:id/order', submitOrder);

export default router;