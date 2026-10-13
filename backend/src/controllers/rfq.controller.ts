import { Request, Response, NextFunction } from 'express';
import { RFQService } from '../services/rfq.service';
import { logger } from '../utils/logger';

export class RFQController {
  private rfqService = new RFQService();

  private getAuthContext(req: Request) {
    const authHeader = req.headers.authorization;
    const organizationId = req.userContext?.organization_id || (req as any).user?.organization_id;
    const userId = req.userContext?.profile_id || req.user?.id;
    return { authHeader, organizationId, userId };
  }

  getTemplates = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const templates = await this.rfqService.getTemplates(authHeader, organizationId);
      res.json(templates);
    } catch (error) { next(error); }
  };

  createTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.createTemplate(authHeader, organizationId, req.body, userId);
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  getTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const template = await this.rfqService.getTemplate(authHeader, organizationId, req.params.id as string);
      res.json(template);
    } catch (error) { next(error); }
  };

  updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.updateTemplate(authHeader, organizationId, req.params.id as string, req.body);
      res.json(result);
    } catch (error) { next(error); }
  };

  inspectTemplateFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      let buffer: Buffer | null = null;
      let fileName = 'uploaded_file.xlsx';
      if (req.file) {
        buffer = req.file.buffer;
        fileName = req.file.originalname;
      } else if (req.body?.fileBase64) {
        buffer = Buffer.from(req.body.fileBase64, 'base64');
        fileName = req.body.fileName || fileName;
      }
      if (!buffer) return res.status(400).json({ error: 'No file provided' });
      const inspection = this.rfqService.inspectTemplateFile(buffer, fileName);
      res.json(inspection);
    } catch (error) { next(error); }
  };

  getRFQs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const rfqs = await this.rfqService.getRFQs(authHeader, organizationId, req.query);
      res.json(rfqs);
    } catch (error) { next(error); }
  };

  createRFQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.createRFQ(authHeader, organizationId, req.body, userId);
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  getRFQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const rfq = await this.rfqService.getRFQ(authHeader, organizationId, req.params.id as string);
      res.json(rfq);
    } catch (error) { next(error); }
  };

  updateRFQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.updateRFQ(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.json(result);
    } catch (error) { next(error); }
  };

  importRFQFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      let buffer: Buffer | null = null;
      let fileName = 'customer_rfq.xlsx';
      if (req.file) {
        buffer = req.file.buffer;
        fileName = req.file.originalname;
      } else if (req.body?.fileBase64) {
        buffer = Buffer.from(req.body.fileBase64, 'base64');
        fileName = req.body.fileName || fileName;
      }
      if (!buffer) return res.status(400).json({ error: 'No file provided' });
      const result = await this.rfqService.importRFQFile(authHeader, organizationId, buffer, fileName, req.body.templateId, userId);
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  exportRFQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const rfqId = req.body?.id || req.query.id;
      if (!rfqId) return res.status(400).json({ error: 'RFQ ID is required' });
      const buffer = await this.rfqService.exportRFQ(authHeader, organizationId, rfqId as string);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=RFQ_${rfqId}.xlsx`);
      res.send(buffer);
    } catch (error) { next(error); }
  };

  validateRFQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.validateRFQ(authHeader, organizationId, req.params.id as string, userId);
      res.json(result);
    } catch (error) { next(error); }
  };

  getRevisions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const revisions = await this.rfqService.getRevisions(authHeader, organizationId, req.params.id as string);
      res.json(revisions);
    } catch (error) { next(error); }
  };

  createRevision = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.createRevision(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  getClarifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const clarifications = await this.rfqService.getClarifications(authHeader, organizationId, req.params.id as string);
      res.json(clarifications);
    } catch (error) { next(error); }
  };

  createClarification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.createClarification(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  createTask = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.createTask(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  getTimeline = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const timeline = await this.rfqService.getTimeline(authHeader, organizationId, req.params.id as string);
      res.json(timeline);
    } catch (error) { next(error); }
  };

  getAudit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const audit = await this.rfqService.getAudit(authHeader, organizationId, req.params.id as string);
      res.json(audit);
    } catch (error) { next(error); }
  };

  getAssessments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId } = this.getAuthContext(req);
      if (!authHeader || !organizationId) return res.status(401).json({ error: 'Unauthorized' });
      const assessments = await this.rfqService.getAssessments(authHeader, organizationId, req.params.id as string, req.params.type as string);
      res.json(assessments);
    } catch (error) { next(error); }
  };

  updateAssessment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.updateAssessment(authHeader, organizationId, req.params.id as string, req.params.type as string, req.body, userId);
      res.json(result);
    } catch (error) { next(error); }
  };

  createQuotation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.createQuotation(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  submitQuotation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.submitQuotation(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.json(result);
    } catch (error) { next(error); }
  };

  holdRFQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.holdRFQ(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.json(result);
    } catch (error) { next(error); }
  };

  winRFQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.winRFQ(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.json(result);
    } catch (error) { next(error); }
  };

  loseRFQ = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { authHeader, organizationId, userId } = this.getAuthContext(req);
      if (!authHeader || !organizationId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      const result = await this.rfqService.loseRFQ(authHeader, organizationId, req.params.id as string, req.body, userId);
      res.json(result);
    } catch (error) { next(error); }
  };
}
