import { Request, Response, NextFunction } from 'express';

/**
 * GET /api/health
 * Returns service status.
 */
export const getHealth = (_req: Request, res: Response, next: NextFunction): void => {
  try {
    res.status(200).json({
      status: 'ok',
      message: 'Backend is running',
    });
  } catch (error) {
    next(error);
  }
};
