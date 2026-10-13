import { Request } from 'express';

export const logger = {
  info: (message: string, meta: Record<string, any> = {}) => {
    console.log(JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), message, ...meta }));
  },
  warn: (message: string, meta: Record<string, any> = {}) => {
    console.warn(JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), message, ...meta }));
  },
  error: (message: string, meta: Record<string, any> = {}) => {
    console.error(JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), message, ...meta }));
  },
  debug: (message: string, meta: Record<string, any> = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify({ level: 'debug', timestamp: new Date().toISOString(), message, ...meta }));
    }
  },
};

export const logRequest = (req: Request, duration: number, statusCode: number, error?: any) => {
  const meta = {
    requestId: (req as any).requestId,
    method: req.method,
    url: req.originalUrl,
    status: statusCode,
    durationMs: duration,
    userId: req.user?.id,
    ip: req.ip,
  };

  if (error) {
    logger.error('Request failed', { ...meta, error: error.message });
  } else {
    logger.info('Request completed', meta);
  }
};
