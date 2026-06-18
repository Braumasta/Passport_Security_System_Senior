import { Router } from 'express';
import applicantRoutes from './applicantRoutes.js';
import applicationRoutes from './applicationRoutes.js';
import authRoutes from './authRoutes.js';
import passportRoutes from './passportRoutes.js';
import userRoutes from './userRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/applicants', applicantRoutes);
router.use('/applications', applicationRoutes);
router.use('/passports', passportRoutes);

export default router;
