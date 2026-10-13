import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { AppError } from '../utils/errors';
import { createSupabaseClientForUser } from '../db/supabase';

export class NotificationController {
  private getService(req: Request): NotificationService {
    const orgId = (req as any).userContext?.organization_id || (req as any).user?.organization_id;
    const userId = (req as any).user?.id;
    if (!orgId || !userId) {
      throw new AppError('Unauthorized: Missing user or organization context', 401);
    }
    const supabase = createSupabaseClientForUser(req);
    return new NotificationService(supabase, orgId, userId);
  }

  // GET /api/notifications
  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getNotifications({
        category: req.query.category as string,
        priority: req.query.priority as string,
        read: req.query.read !== undefined ? req.query.read === 'true' : undefined,
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      });
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/notifications/unread-count
  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getUnreadCount();
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/notifications/:id/read
  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.markAsRead(req.params.id as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // PATCH /api/notifications/:id/unread
  markAsUnread = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.markAsUnread(req.params.id as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/notifications/mark-all-read
  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.markAllAsRead(req.body.category as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // DELETE /api/notifications/:id (or dismiss)
  dismiss = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.dismiss(req.params.id as string);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/notifications/preferences
  getPreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getUserPreferences();
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // PUT /api/notifications/preferences
  updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.updateUserPreferences(req.body);
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // GET /api/notifications/meeting-alerts
  getMeetingAlerts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getActiveMeetingPrompts();
      res.json(data);
    } catch (err) {
      next(err);
    }
  };

  // POST /api/notifications/test-alert
  sendTestAlert = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const userId = (req as any).user.id;
      const data = await service.createNotification({
        recipient_id: userId,
        type: 'TEST_ALERT',
        title: 'BDIQ Enterprise Notification Test',
        message: 'This is a test notification confirming browser and in-app alert delivery.',
        category: 'SYSTEM',
        priority: 'MEDIUM',
        metadata: { is_test: true, sent_at: new Date().toISOString() },
      });
      res.json({ success: true, notification: data });
    } catch (err) {
      next(err);
    }
  };
}
