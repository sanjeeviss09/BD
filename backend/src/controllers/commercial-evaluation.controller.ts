import { Request, Response, NextFunction } from 'express';
import { CommercialEvaluationService } from '../services/commercial-evaluation.service';
import { logger } from '../utils/logger';

export class CommercialEvaluationController {
  private commercialService = new CommercialEvaluationService();

  private getAuthContext(req: Request) {
    const authHeader = req.headers.authorization;
    const organizationId = req.userContext?.organization_id || (req as any).user?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.userContext?.profile_id || req.user?.id || 'u0000000-0000-0000-0000-000000000001';
    return { authHeader, organizationId, userId };
  }

  getEvaluations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const evaluations = await this.commercialService.getEvaluations(authHeader, organizationId, req.query);
      res.json(evaluations);
    } catch (error) {
      next(error);
    }
  };

  getEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const evaluation = await this.commercialService.getEvaluation(authHeader, organizationId, req.params.id as string);
      res.json(evaluation);
    } catch (error) {
      next(error);
    }
  };

  createEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const created = await this.commercialService.createEvaluation(authHeader, organizationId, req.body, userId);
      res.status(201).json(created);
    } catch (error) {
      next(error);
    }
  };

  updateEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const updated = await this.commercialService.updateEvaluation(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  updateCostComponents = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const updated = await this.commercialService.updateCostComponents(
        authHeader,
        organizationId,
        req.params.id as string,
        req.body.costs || [],
        userId
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  updatePricing = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const updated = await this.commercialService.updatePricing(
        authHeader,
        organizationId,
        req.params.id as string,
        req.body,
        userId
      );
      res.json(updated);
    } catch (error) {
      next(error);
    }
  };

  finalizeEvaluation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const result = await this.commercialService.finalizeEvaluation(
        authHeader,
        organizationId,
        req.params.id as string,
        req.body,
        userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createNewVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const result = await this.commercialService.createNewVersion(
        authHeader,
        organizationId,
        req.params.id as string,
        req.body.summary || 'Parameters revised',
        userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const analytics = await this.commercialService.getAnalytics(authHeader, organizationId);
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  };

  exportDossier = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const { buffer, fileName } = await this.commercialService.exportCommercialDossier(
        authHeader,
        organizationId,
        req.params.id as string
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
