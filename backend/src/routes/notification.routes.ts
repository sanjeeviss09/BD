import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();
const controller = new NotificationController();

router.use(requireAuth);

router.get('/', controller.getNotifications);
router.get('/unread-count', controller.getUnreadCount);
router.get('/meeting-alerts', controller.getMeetingAlerts);
router.get('/preferences', controller.getPreferences);
router.put('/preferences', controller.updatePreferences);
router.post('/mark-all-read', controller.markAllAsRead);
router.post('/test-alert', controller.sendTestAlert);

router.patch('/:id/read', controller.markAsRead);
router.patch('/:id/unread', controller.markAsUnread);
router.delete('/:id', controller.dismiss);
router.post('/:id/dismiss', controller.dismiss);

export const notificationRoutes = router;
export default router;
