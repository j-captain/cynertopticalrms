import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  pendingOrders,
  allOrdersForOptician,
  opticianSummary,
  submitBill,
  deliverOrder,
  opticianBilledOrders,
  opticianEditBill,
  directorOrders,
  directorSummary,
  markPaid,
  adminBillingOverview,
  adminBillingSummary,
  adminBillOrder,
  adminEditBill,
  adminMarkPaid,
  adminDeliver,
  adminRevertToPending,
  adminRevertToBilled,
} from '../controllers/billingController.js';

const router = Router();
router.use(protect);

/* Optician */
router.get('/optician/pending', pendingOrders);
router.get('/optician/billed', opticianBilledOrders);
router.get('/optician/all', allOrdersForOptician);
router.get('/optician/summary', opticianSummary);
router.post('/optician/:id/bill', submitBill);
router.post('/optician/:id/deliver', deliverOrder);
router.put('/optician/:id/edit-bill', opticianEditBill);

/* Director */
router.get('/director/orders', directorOrders);
router.get('/director/summary', directorSummary);
router.post('/director/:id/paid', markPaid);

/* Admin */
router.get('/admin/overview', adminBillingOverview);
router.get('/admin/summary', adminBillingSummary);
router.post('/admin/:id/bill', adminBillOrder);
router.post('/admin/:id/edit-bill', adminEditBill);
router.post('/admin/:id/paid', adminMarkPaid);
router.post('/admin/:id/deliver', adminDeliver);
router.post('/admin/:id/revert-pending', adminRevertToPending);
router.post('/admin/:id/revert-billed', adminRevertToBilled);

export default router;