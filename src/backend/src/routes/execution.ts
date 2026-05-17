import { Router } from 'express';
import { executionController } from '../controllers/execution';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { executeCodeSchema, executeFileSchema } from '../validators/execution';
import { executeRateLimiter } from '../middleware/rateLimit';

const router = Router();

router.use(authenticate);

/*
  Body:
  {
    "code": "print('hello world')",
    "language": "python"   //optional, defaults to python
  }
  Response:
  {
    "success": true,
    "message": "Code executed successfully",
    "data": {
      "output": "hello world\n",
      "exitCode": 0
    },
    "timestamp": "..."
  }
*/
router.post(
  '/code',
  validate(executeCodeSchema),
  executeRateLimiter,
  executionController.executeCode.bind(executionController)
);

/*
  Body:
  {
    "storageKey": "users/abc123/hello.py",
    "language": "python"   //optional, defaults to python
  }
  Response:
  {
    "success": true,
    "message": "File executed successfully",
    "data": {
      "output": "hello world\n",
      "exitCode": 0
    },
    "timestamp": "..."
  }
*/
router.post(
  '/file',
  validate(executeFileSchema),
  executeRateLimiter,
  executionController.executeFile.bind(executionController)
);

export default router;
