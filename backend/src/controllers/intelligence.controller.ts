import { Request, Response, NextFunction } from 'express';
import { IntelligenceService } from '../services/intelligence.service';
import { AppError } from '../utils/errors';

export class IntelligenceController {
  
  // Need to bind methods because they are passed as callbacks in router
  constructor() {
    this.listCompetitors = this.listCompetitors.bind(this);
    this.runCompetitorAnalysis = this.runCompetitorAnalysis.bind(this);
    this.listCountries = this.listCountries.bind(this);
    this.runCountryAnalysis = this.runCountryAnalysis.bind(this);
  }

  private getService(req: Request): IntelligenceService {
    const user = (req as any).user;
    if (!user?.organization_id) {
      throw new AppError('Unauthorized: Missing organization context', 401);
    }
    return new IntelligenceService(user.organization_id, user.id);
  }

  async listCompetitors(req: Request, res: Response, next: NextFunction) {
    try {
      const service = this.getService(req);
      const subjectType = req.query.subjectType as string;
      const subjectId = req.query.subjectId as string;
      const data = await service.getCompetitors(subjectType, subjectId);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  async runCompetitorAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const service = this.getService(req);
      const data = await service.analyzeCompetitors(req.body);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  async listCountries(req: Request, res: Response, next: NextFunction) {
    try {
      const service = this.getService(req);
      const subjectType = req.query.subjectType as string;
      const subjectId = req.query.subjectId as string;
      const data = await service.getCountries(subjectType, subjectId);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }

  async runCountryAnalysis(req: Request, res: Response, next: NextFunction) {
    try {
      const service = this.getService(req);
      const data = await service.analyzeCountries(req.body);
      res.json({ status: 'success', data });
    } catch (error) {
      next(error);
    }
  }
}
