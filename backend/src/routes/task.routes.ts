import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission, requireAnyPermission } from '../middleware/permission.middleware';
import { 
  createTask, 
  getTasks, 
  getTask, 
  updateTask,
  assignTask,
  recordNoUpdate, 
  recordUpdateReceived, 
  recordPartialUpdate,
  rescheduleTask,
  holdTask,
  resumeTask,
  completeTask,
  cancelTask,
  reopenTask,
  addWatcher,
  removeWatcher,
  addComment,
  getDashboardAnalytics,
  runMonitoringJob
} from '../controllers/task.controller';

const router = Router();

router.use(requireAuth, loadUserContext);

// Analytics
router.get('/analytics', requirePermission('tasks.analytics'), getDashboardAnalytics);

// Background Job execution
router.post('/jobs/monitoring', requirePermission('tasks.admin'), runMonitoringJob);

// Core CRUD
router.get('/', requirePermission('tasks.read'), getTasks);
router.get('/:id', requirePermission('tasks.read'), getTask);
router.post('/', requirePermission('tasks.create'), createTask);
router.put('/:id', requirePermission('tasks.update'), updateTask);

// Assignment
router.put('/:id/assign', requirePermission('tasks.assign'), assignTask);

// Follow-up Actions
router.post('/:id/no-update', requirePermission('tasks.followup'), recordNoUpdate);
router.post('/:id/update-received', requirePermission('tasks.followup'), recordUpdateReceived);
router.post('/:id/partial-update', requirePermission('tasks.followup'), recordPartialUpdate);
router.post('/:id/reschedule', requirePermission('tasks.reschedule'), rescheduleTask);

// Hold & Resume
router.post('/:id/hold', requirePermission('tasks.update'), holdTask);
router.post('/:id/resume', requirePermission('tasks.update'), resumeTask);

// Lifecycle transitions
router.post('/:id/complete', requirePermission('tasks.complete'), completeTask);
router.post('/:id/cancel', requirePermission('tasks.cancel'), cancelTask);
router.post('/:id/reopen', requireAnyPermission(['tasks.admin', 'tasks.update']), reopenTask);

// Watchers
router.post('/:id/watchers', requirePermission('tasks.update'), addWatcher);
router.delete('/:id/watchers/:userId', requirePermission('tasks.update'), removeWatcher);

// Collaboration & Comments
router.post('/:id/comments', requirePermission('tasks.read'), addComment);

export default router;
