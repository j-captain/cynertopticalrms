import { Router } from 'express';
import { protect, requireAdmin } from '../middleware/auth.js';
import {
  listCollections,
  exportCollection,
  exportAll,
  emptyCollection,
  dropCollection,
  restoreCollection,
  restoreAll,
  health,
  viewCollection,
} from '../controllers/dbController.js';

const router = Router();
router.use(protect, requireAdmin);

router.get('/collections', listCollections);
router.get('/health', health);

router.get('/export/:name', exportCollection);
router.get('/export-all', exportAll);

router.get('/view/:name', viewCollection);

router.post('/empty/:name', emptyCollection);
router.post('/drop/:name', dropCollection);

router.post('/restore/:name', restoreCollection);
router.post('/restore-all', restoreAll);

export default router;