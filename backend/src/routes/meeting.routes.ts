import { Router } from 'express';
import { MeetingController } from '../controllers/meeting.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext } from '../middleware/permission.middleware';

const router = Router();
const controller = new MeetingController();

router.use(requireAuth, loadUserContext);

// Dashboard Overview & Analytics
router.get('/dashboard/overview', controller.getDashboardOverview);

// Configuration & Templates (Registered before parameterized :id routes)
router.get('/configurations', controller.getConfigurations);
router.patch('/configurations/:key', controller.updateConfiguration);
router.get('/templates', controller.listTemplates);
router.post('/templates', controller.createTemplate);

// Quick Capture parsing
router.post('/quick-capture/parse', controller.quickCaptureParse);

// Core Meeting CRUD
router.get('/', controller.listMeetings);
router.post('/', controller.createMeeting);
router.get('/:id', controller.getMeeting);
router.patch('/:id', controller.updateMeeting);
router.post('/:id/start', controller.startMeeting);
router.post('/:id/end', controller.endMeeting);

// Preparation Workspace
router.get('/:id/preparation', controller.getPreparationWorkspace);

// Live Mini Notes
router.get('/:id/notes', controller.getNotes);
router.post('/:id/notes', controller.createNote);
router.patch('/notes/:noteId', controller.updateNote);
router.patch('/:id/notes/:noteId', controller.updateNote);
router.delete('/notes/:noteId', controller.deleteNote);
router.delete('/:id/notes/:noteId', controller.deleteNote);

// Structured Meeting Points & Action Items
router.get('/:id/points', controller.getMeetingPoints);
router.post('/:id/points', controller.createMeetingPoint);
router.patch('/points/:pointId', controller.updateMeetingPoint);
router.patch('/:id/points/:pointId', controller.updateMeetingPoint);
router.post('/points/:pointId/carry-forward', controller.carryForwardPoint);
router.post('/:id/points/:pointId/carry-forward', controller.carryForwardPoint);
router.post('/points/:pointId/create-task', controller.convertPointToTask);
router.post('/:id/points/:pointId/create-task', controller.convertPointToTask);

// Formal Decisions
router.get('/:id/decisions', controller.getDecisions);
router.post('/:id/decisions', controller.createDecision);
router.patch('/decisions/:decisionId/confirm', controller.confirmDecision);
router.patch('/:id/decisions/:decisionId/confirm', controller.confirmDecision);
router.patch('/:id/decisions/:decisionId', controller.confirmDecision);

// Minutes of Meeting (MOM) Generation & Confirmation
router.post('/:id/mom/generate', controller.generateMOMDraft);
router.post('/:id/mom/confirm', controller.confirmMOM);

// Phase 3 Grounded Meeting Intelligence, Copilot Queries & Suggestion Pipeline
router.post('/:id/ai-intelligence', controller.generateMeetingIntelligence);
router.post('/:id/ai-intelligence/apply', controller.applyAISuggestions);
router.post('/:id/ai-intelligence/query', controller.queryCopilot);

// Meeting Closure Wizard
router.post('/:id/closure', controller.executeMeetingClosure);

// Minutes Export (Excel Workbook)
router.get('/:id/export', controller.exportMinutesWorkbook);
router.get('/:id/export/excel', controller.exportMinutesWorkbook);

export const meetingRoutes = router;
