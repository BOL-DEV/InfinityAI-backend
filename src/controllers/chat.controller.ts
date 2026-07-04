import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChatService } from '../services/chatService';
import { AppError } from '../utils/errors';

const chatSchema = z.object({
  chatId: z.string().uuid('chatId must be a valid UUID'),
  message: z.string().min(1, 'Message is required and cannot be empty'),
});

export class ChatController {
  /**
   * Endpoint handler for answering queries using chat history + memories + Groq.
   * POST /api/chat
   */
  public static async chat(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = chatSchema.safeParse(req.body);
      if (!result.success) {
        const errorMsg = result.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError(errorMsg, 400);
      }

      const { chatId, message } = result.data;
      const response = await ChatService.processChat(chatId, message);

      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }
}
