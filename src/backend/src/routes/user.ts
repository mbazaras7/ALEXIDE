import { Router } from 'express';
import { userController } from '../controllers/user';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, updateProfileSchema } from '../validators/user';

const router = Router();

//POST /api/backend/auth/register
router.post('/register', validate(registerSchema), userController.register.bind(userController));

//POST /api/backend/auth/login
router.post('/login', validate(loginSchema), userController.login.bind(userController));

//All routes below require authentication
router.use(authenticate);

//GET /api/backend/auth/me
router.get('/me', userController.getMe.bind(userController));

//PUT /api/backend/auth/me
router.put('/me', validate(updateProfileSchema), userController.updateMe.bind(userController));

//POST /api/backend/auth/logout
router.post('/logout', userController.logout.bind(userController));

//DELETE /api/backend/auth/delete
router.delete('/delete', userController.deleteAccount.bind(userController));

export default router;
