import { Router, Request, Response } from 'express';
import { client } from '../db';
import { ResponseHandler } from '../utils/response';

const router = Router();

interface HealthData {
  status: 'healthy';
  services: {
    api: 'up';
    database: 'connected';
  };
}

//GET /api/backend/health
/*
Response:
{
  "success": true,
  "message": "All systems operational",
  "data": {
    "status": "healthy",
    "services": {
      "api": "up",
      "database": "connected"
    }
  },
  "timestamp": "2026-02-04T14:29:18.635Z"
}
*/
router.get('/', async (req: Request, res: Response) => {
  try {
    await client`SELECT 1`;

    const healthData: HealthData = {
      status: 'healthy',
      services: {
        api: 'up',
        database: 'connected',
      },
    };

    return ResponseHandler.success(res, healthData, 'All systems operational');
  } catch {
    return ResponseHandler.error(res, 'Database connection failed', 503);
  }
});

export default router;
