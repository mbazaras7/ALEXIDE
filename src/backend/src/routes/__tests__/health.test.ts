import request from 'supertest';
import { describe, it, expect } from '@jest/globals';
import app from '../../app';

describe('GET /api/backend/health', () => {
  it('should return 200 and healthy status when all services are up', async () => {
    const response = await request(app).get('/api/backend/health').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      message: 'All systems operational',
      data: {
        status: 'healthy',
        services: {
          api: 'up',
          database: 'connected',
        },
      },
    });

    expect(response.body.timestamp).toBeDefined();
  });
});
