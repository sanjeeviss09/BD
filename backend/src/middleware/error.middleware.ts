import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = (req as any).requestId || 'unknown';

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[${requestId}] Operational Error: ${err.message}`, { error: err.details, stack: err.stack });
    } else {
      logger.warn(`[${requestId}] Client Error: ${err.message}`, { errorCode: err.errorCode, details: err.details });
    }

    return res.status(err.statusCode).json({
      error: {
        code: err.errorCode,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
  }

  // Handle generic / unexpected errors
  logger.error(`[${requestId}] Unexpected Error: ${err.message}`, { stack: err.stack });
  
  return res.status(500).json({
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: err.message || 'An unexpected error occurred. Please try again later.',
      details: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
      requestId,
    },
  });
};
