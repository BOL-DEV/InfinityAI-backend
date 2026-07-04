import { Router } from 'express';
import { MemoryController } from '../controllers/memory.controller';

const router = Router();

router.post('/ingest', MemoryController.ingest);
router.get('/search', MemoryController.search);
router.delete('/forget', MemoryController.forget);

export default router;
