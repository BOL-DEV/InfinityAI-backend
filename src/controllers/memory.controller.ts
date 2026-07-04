import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { MemoryService } from '../services/memoryService';
import { AppError } from '../utils/errors';

const ingestSchema = z.object({
  url: z.string().url('Invalid URL format'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  timestamp: z.string().min(1, 'Timestamp is required'),
});

const forgetSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

export class MemoryController {
  /**
   * Endpoint handler to save web memory node.
   * POST /api/memory/ingest
   */
  public static async ingest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = ingestSchema.safeParse(req.body);
      if (!result.success) {
        const errorMsg = result.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError(errorMsg, 400);
      }

      const { url, title, content, timestamp } = result.data;
      await MemoryService.ingestMemory(url, title, content, timestamp);

      res.status(200).json({
        success: true,
        message: 'Memory stored successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Debug / search endpoint handler to test memory retrieval.
   * GET /api/memory/search?q=query_string
   */
  public static async search(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const q = req.query.q;
      if (!q || typeof q !== 'string' || q.trim() === '') {
        throw new AppError('Query parameter "q" is required and cannot be empty', 400);
      }

      const memories = await MemoryService.searchMemory(q);

      res.status(200).json({
        success: true,
        memories,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Endpoint handler to delete a memory.
   * DELETE /api/memory/forget
   */
  public static async forget(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = forgetSchema.safeParse(req.body);
      if (!result.success) {
        const errorMsg = result.error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        throw new AppError(errorMsg, 400);
      }

      const { url } = result.data;
      await MemoryService.forgetMemory(url);

      res.status(200).json({
        success: true,
        message: 'Memory forgotten successfully',
      });
    } catch (err) {
      next(err);
    }
  }
}
