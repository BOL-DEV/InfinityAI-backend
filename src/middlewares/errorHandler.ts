import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'Internal server error occurred';

  // Log errors
  if (err instanceof AppError && err.isOperational) {
    if (env.NODE_ENV === 'development') {
      console.warn(`[Operational Error ${statusCode}]: ${message}`);
    }
  } else {
    // Structural/programming errors
    console.error('💥 Critical Error:', err);
  }

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
