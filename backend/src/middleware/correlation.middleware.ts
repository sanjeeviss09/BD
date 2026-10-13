import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logRequest } from '../utils/logger';

export const correlationIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId as string);
  
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req, duration, res.statusCode);
  });
  
  next();
};
