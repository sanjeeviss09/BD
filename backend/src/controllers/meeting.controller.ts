import { Request, Response, NextFunction } from 'express';
import { MeetingService } from '../services/meeting.service';
import { AppError } from '../utils/errors';
import { createSupabaseClientForUser } from '../db/supabase';

export class MeetingController {
  private getService(req: Request): MeetingService {
    const orgId = (req as any).userContext?.organization_id || (req as any).user?.organization_id;
    const userId = (req as any).user?.id;
    if (!orgId) {
      throw new AppError('Unauthorized: Missing organization context', 401);
    }
    const supabase = createSupabaseClientForUser(req);
    return new MeetingService(supabase, orgId, userId);
  }

  // Dashboard Overview
  getDashboardOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getDashboardOverview(req.query);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  listMeetings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.listMeetings(req.query);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  createMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.createMeeting(req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  getMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getMeeting(req.params.id as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  updateMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.updateMeeting(req.params.id as string, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  startMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.startMeeting(req.params.id as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  endMeeting = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.endMeeting(req.params.id as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  // Preparation Workspace
  getPreparationWorkspace = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getPreparationWorkspace(req.params.id as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  // Live Mini Notes
  getNotes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getNotes(req.params.id as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  createNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.createNote(req.params.id as string, req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  updateNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.updateNote(req.params.noteId as string, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  deleteNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.deleteNote(req.params.noteId as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  quickCaptureParse = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = service.quickCaptureParse(req.body.text as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  // Meeting Points
  getMeetingPoints = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getMeetingPoints(req.params.id as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  createMeetingPoint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.createMeetingPoint(req.params.id as string, req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  updateMeetingPoint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.updateMeetingPoint(req.params.pointId as string, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  carryForwardPoint = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.carryForwardPoint(
        req.params.pointId as string,
        req.body.target_meeting_id as string,
        req.body.reason as string
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  convertPointToTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.convertPointToTask(req.params.pointId as string, req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  // Decisions
  getDecisions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getDecisions(req.params.id as string);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  createDecision = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.createDecision(req.params.id as string, req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  // Closure Wizard
  executeMeetingClosure = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.executeMeetingClosure(req.params.id as string, req.body);
      res.json(data);
    } catch (error)
    {
      next(error);
    }
  };

  // Export
  exportMinutesWorkbook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const buffer = await service.exportMinutesWorkbook(req.params.id as string);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Meeting_Minutes_${req.params.id}.xlsx`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  // Configurations
  getConfigurations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.getConfigurations();
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  updateConfiguration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.updateConfiguration(
        req.params.key as string,
        req.body.value,
        req.body.change_reason as string
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  // Templates
  listTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.listTemplates();
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = this.getService(req);
      const data = await service.createTemplate(req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };
}
