import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChatSessionService } from '../services/chatSessionService';
import { AppError } from '../utils/errors';

const chatIdParamSchema = z.object({
  chatId: z.string().uuid('chatId must be a valid UUID'),
});

export class ChatSessionController {
  /**
   * Creates a new chat session.
   * POST /api/chats
   */
  public static async createChat(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const response = await ChatSessionService.createChat();
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves all chat sessions.
   * GET /api/chats
   */
  public static async getChats(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const response = await ChatSessionService.getChats();
      res.status(200).json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Retrieves a single chat session by ID.
   * GET /api/chats/:chatId
   */
  public static async getChat(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const paramResult = chatIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid chat ID parameter format', 400);
      }

      const { chatId } = paramResult.data;
      const chat = await ChatSessionService.getChat(chatId);
      if (!chat) {
        throw new AppError(`Chat session with ID ${chatId} not found`, 404);
      }

      res.status(200).json(chat);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Deletes a chat session by ID.
   * DELETE /api/chats/:chatId
   */
  public static async deleteChat(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const paramResult = chatIdParamSchema.safeParse(req.params);
      if (!paramResult.success) {
        throw new AppError('Invalid chat ID parameter format', 400);
      }

      const { chatId } = paramResult.data;
      // Check if session exists first
      const exists = await ChatSessionService.getChat(chatId);
      if (!exists) {
        throw new AppError(`Chat session with ID ${chatId} not found`, 404);
      }

      await ChatSessionService.deleteChat(chatId);
      res.status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
