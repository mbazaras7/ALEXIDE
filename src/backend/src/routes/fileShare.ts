import { Router } from 'express';
import { fileShareController } from '../controllers/fileShare';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createShareSchema, resolveShareSchema, revokeShareSchema } from '../validators/fileShare';

const router = Router();

router.use(authenticate);

//POST /api/backend/share/files/:id
router.post(
  '/files/:id',
  validate(createShareSchema),
  fileShareController.createShare.bind(fileShareController)
);

//GET /api/backend/share/:code
router.get(
  '/:code',
  validate(resolveShareSchema),
  fileShareController.resolveShare.bind(fileShareController)
);

//DELETE /api/backend/share/files/:id
router.delete(
  '/files/:id',
  validate(revokeShareSchema),
  fileShareController.revokeShare.bind(fileShareController)
);

export default router;
