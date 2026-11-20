import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  pendingOrders,
  opticianBilledOrders,
  allOrdersForOptician,
  opticianSummary,
  submitBill,
  opticianEditBill,
  deliverOrder,
  completeBilling,
  listBatches,
  cancelBatch,
  directorBatches,
  markBatchPaid,
  directorSummary,
  adminBillingOverview,
  adminBillingSummary,
  adminBillOrder,
  adminEditBill,
  adminMarkPaid,
  adminDeliver,
  adminRevertToPending,
  adminRevertToBilled,
  adminListBatches,
  adminBatchAction,
  listUndelivered,
  deliverBatch,
  deliverIndividual,
} from '../controllers/billingController.js';

const router = Router();
router.use(protect);

/* Optician — specific before :id */
router.get('/optician/pending', pendingOrders);
router.get('/optician/billed', opticianBilledOrders);
router.get('/optician/all', allOrdersForOptician);
router.get('/optician/summary', opticianSummary);
router.post('/optician/complete-billing', completeBilling);
router.post('/optician/:id/bill', submitBill);
router.post('/optician/:id/deliver', deliverOrder);        // legacy — still used by any old UI path
router.put('/optician/:id/edit-bill', opticianEditBill);

/* Undelivered — shared (optician + admin) */
router.get('/undelivered', listUndelivered);
router.post('/undelivered/batch/:id/deliver', deliverBatch);
router.post('/undelivered/order/:id/deliver', deliverIndividual);

/* Batches — shared */
router.get('/batches', listBatches);
router.post('/batches/:id/cancel', cancelBatch);

/* Director — batches, not orders */
router.get('/director/batches', directorBatches);
router.post('/director/batches/:id/paid', markBatchPaid);
router.get('/director/summary', directorSummary);

/* Admin */
router.get('/admin/overview', adminBillingOverview);
router.get('/admin/summary', adminBillingSummary);
router.get('/admin/batches', adminListBatches);
router.post('/admin/batches/:id/action', adminBatchAction);
router.post('/admin/:id/bill', adminBillOrder);
router.post('/admin/:id/edit-bill', adminEditBill);
router.post('/admin/:id/paid', adminMarkPaid);
router.post('/admin/:id/deliver', adminDeliver);
router.post('/admin/:id/revert-pending', adminRevertToPending);
router.post('/admin/:id/revert-billed', adminRevertToBilled);

export default router;