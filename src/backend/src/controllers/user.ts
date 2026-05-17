import type { Response } from 'express';
import { userService } from '../services/user';
import { JwtService } from '../config/auth';
import { ResponseHandler } from '../utils/response';
import type { AuthRequest } from '../middleware/auth';
import { containerService } from '../services/container';
import type { RegisterData, LoginData } from '../validators/user';

export class UserController {
  //POST /api/backend/auth/register
  async register(req: { body: RegisterData }, res: Response): Promise<void> {
    const { email, password, name, role } = req.body;
    const existingUser = await userService.findByEmail(email);
    if (existingUser) {
      ResponseHandler.conflict(res, 'User already exists');
      return;
    }
    try {
      const user = await userService.createUser(email, password, name, role);
      ResponseHandler.created(res, user, 'User registered successfully');
    } catch {
      ResponseHandler.serverError(res, 'Failed to create user');
    }
  }

  //POST /api/backend/auth/login
  async login(req: { body: LoginData }, res: Response): Promise<void> {
    const { email, password } = req.body;
    try {
      const userPayload = await userService.validateUser(email, password);
      if (!userPayload) {
        ResponseHandler.unauthorized(res, 'Invalid email or password');
        return;
      }
      const userRecord = await userService.findById(userPayload.userId);
      const token = JwtService.generateToken(userPayload);
      ResponseHandler.success(res, {
        token,
        user: {
          id: userPayload.userId,
          email: userPayload.email,
          name: userRecord?.name ?? '',
          role: userPayload.role,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      ResponseHandler.serverError(res, 'Login failed');
    }
  }

  //GET /api/backend/auth/me
  async getMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHandler.unauthorized(res, 'User not authenticated');
        return;
      }
      const user = await userService.findById(userId);
      if (!user) {
        ResponseHandler.notFound(res, 'User not found');
        return;
      }
      ResponseHandler.success(
        res,
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          },
        },
        'User profile retrieved successfully'
      );
    } catch (error) {
      console.error('Get profile error:', error);
      ResponseHandler.serverError(res, 'Failed to retrieve profile');
    }
  }

  //PUT /api/backend/auth/me
  async updateMe(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHandler.unauthorized(res, 'User not authenticated');
        return;
      }
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        ResponseHandler.badRequest(res, 'Valid name is required');
        return;
      }
      const updatedUser = await userService.updateUser(userId, { name: name.trim() });
      if (!updatedUser) {
        ResponseHandler.notFound(res, 'User not found');
        return;
      }
      ResponseHandler.success(
        res,
        {
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            createdAt: updatedUser.createdAt,
            updatedAt: updatedUser.updatedAt,
          },
        },
        'Profile updated successfully'
      );
    } catch (error) {
      console.error('Update profile error:', error);
      ResponseHandler.serverError(res, 'Failed to update profile');
    }
  }

  //POST /api/backend/auth/logout
  async logout(req: AuthRequest, res: Response): Promise<void> {
    const userId = req.user!.userId;
    containerService
      .destroyContainer(userId)
      .catch((err) => console.warn('Container cleanup failed:', err?.message));
    ResponseHandler.success(res, null, 'Logged out successfully');
  }

  //DELETE /api/backend/auth/delete
  async deleteAccount(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        ResponseHandler.unauthorized(res, 'User not authenticated');
        return;
      }
      containerService
        .destroyContainer(userId)
        .catch((err) => console.warn('Container cleanup on account delete failed:', err?.message));
      await userService.deleteUser(userId);
      ResponseHandler.success(res, null, 'Account deleted successfully');
    } catch (error) {
      console.error('Delete account error:', error);
      ResponseHandler.serverError(res, 'Failed to delete account');
    }
  }
}

export const userController = new UserController();
