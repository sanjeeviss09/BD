import { Request, Response, NextFunction } from 'express';
import { RegulatoryService } from '../services/regulatory.service';
import { logger } from '../utils/logger';

export class RegulatoryController {
  private regulatoryService = new RegulatoryService();

  private getAuthContext(req: Request) {
    const authHeader = req.headers.authorization;
    const organizationId = req.userContext?.organization_id || (req as any).user?.organization_id || 'a0000000-0000-0000-0000-000000000001';
    const userId = req.userContext?.profile_id || req.user?.id || 'u0000000-0000-0000-0000-000000000001';
    return { authHeader, organizationId, userId };
  }

  getSources = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const sources = await this.regulatoryService.getSources(authHeader, organizationId);
      res.json(sources);
    } catch (error) {
      next(error);
    }
  };

  getAuthorities = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const authorities = await this.regulatoryService.getAuthorities(authHeader);
      res.json(authorities);
    } catch (error) {
      next(error);
    }
  };

  getDatasets = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const datasets = await this.regulatoryService.getDatasets(authHeader, organizationId);
      res.json(datasets);
    } catch (error) {
      next(error);
    }
  };

  getRecords = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const records = await this.regulatoryService.getRecords(authHeader, organizationId, req.query);
      res.json(records);
    } catch (error) {
      next(error);
    }
  };

  getRecord = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const record = await this.regulatoryService.getRecord(authHeader, organizationId, req.params.id as string);
      res.json(record);
    } catch (error) {
      next(error);
    }
  };

  getProductProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const profile = await this.regulatoryService.getProductRegulatoryProfile(authHeader, organizationId, req.params.productId as string);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  };

  createAssessment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const assessment = await this.regulatoryService.createAssessment(authHeader, organizationId, req.body, userId);
      res.status(201).json(assessment);
    } catch (error) {
      next(error);
    }
  };

  getAssessmentsForProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const assessments = await this.regulatoryService.getAssessmentsForProduct(authHeader, organizationId, req.params.productId as string);
      res.json(assessments);
    } catch (error) {
      next(error);
    }
  };

  getAssessmentsForOpportunity = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const assessments = await this.regulatoryService.getAssessmentsForOpportunity(authHeader, organizationId, req.params.opportunityId as string);
      res.json(assessments);
    } catch (error) {
      next(error);
    }
  };

  getAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const analytics = await this.regulatoryService.getRegulatoryAnalytics(authHeader, organizationId);
      res.json(analytics);
    } catch (error) {
      next(error);
    }
  };

  getRecordLineage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const lineage = await this.regulatoryService.getRecordLineage(authHeader, organizationId, req.params.id as string);
      res.json(lineage);
    } catch (error) {
      next(error);
    }
  };

  resolveMatch = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const resolved = await this.regulatoryService.resolveMatch(
        authHeader,
        organizationId,
        req.params.id as string,
        req.body,
        userId
      );
      res.json(resolved);
    } catch (error) {
      next(error);
    }
  };

  exportProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const { buffer, fileName } = await this.regulatoryService.exportRegulatoryProfile(
        authHeader,
        organizationId,
        req.params.productId as string
      );

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  importFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const sourceId = req.body.sourceId || 's0000000-0000-0000-0000-000000000001';
      const result = await this.regulatoryService.importRegulatoryFile(
        authHeader,
        organizationId,
        req.file.buffer,
        sourceId,
        userId,
        req.body.datasetCode
      );

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };
}
