import { Router } from 'express';
import { ChatSessionController } from '../controllers/chatSession.controller';

const router = Router();

router.post('/', ChatSessionController.createChat);
router.get('/', ChatSessionController.getChats);
router.get('/:chatId', ChatSessionController.getChat);
router.delete('/:chatId', ChatSessionController.deleteChat);

export default router;
