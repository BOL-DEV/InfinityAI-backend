import { Router } from 'express';
import healthRoutes from './health.routes';
import memoryRoutes from './memory.routes';
import chatRoutes from './chat.routes';
import chatSessionRoutes from './chatSession.routes';

const router = Router();

// Hook individual modules
router.use('/health', healthRoutes);
router.use('/memory', memoryRoutes);
router.use('/chat', chatRoutes);
router.use('/chats', chatSessionRoutes);

export default router;
