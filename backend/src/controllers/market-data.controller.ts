import { Request, Response, NextFunction } from 'express';
import { MarketDataService } from '../services/market-data.service';
import { AppError } from '../utils/errors';
import { createSupabaseClientForUser } from '../db/supabase';

const getService = (req: Request) => {
  const supabase = createSupabaseClientForUser(req);
  return new MarketDataService(supabase);
};

export const createImportSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      throw new AppError('No file uploaded', 400);
    }

    const orgId = (req as any).user?.organization_id;
    const userId = (req as any).user?.id;
    
    if (!orgId || !userId) {
      throw new AppError('Unauthorized', 401);
    }

    const service = getService(req);
    const session = await service.createImportSession(orgId, userId, file);

    res.status(201).json({
      status: 'success',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

export const getImportSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organization_id;

    const service = getService(req);
    const session = await service.getImportSession(orgId, id as string);

    res.json({
      status: 'success',
      data: session
    });
  } catch (error) {
    next(error);
  }
};

export const inspectImportSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organization_id;

    const service = getService(req);
    const result = await service.inspectImportSession(orgId, id as string);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const selectSheet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { sheetName } = req.body;
    const orgId = (req as any).user?.organization_id;

    if (!sheetName) {
      throw new AppError('Sheet name is required', 400);
    }

    const service = getService(req);
    const result = await service.selectSheet(orgId, id as string, sheetName);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const saveMapping = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { mappings } = req.body;
    const orgId = (req as any).user?.organization_id;

    if (!mappings) {
      throw new AppError('Mappings are required', 400);
    }

    const service = getService(req);
    const result = await service.saveMapping(orgId, id as string, mappings);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const validateImportSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organization_id;

    const service = getService(req);
    const result = await service.validateImportSession(orgId, id as string);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getQuality = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organization_id;

    const service = getService(req);
    const result = await service.getQuality(orgId, id as string);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getMatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organization_id;

    const service = getService(req);
    const result = await service.getMatches(orgId, id as string);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const confirmImport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organization_id;

    const service = getService(req);
    const result = await service.confirmImport(orgId, id as string);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const processImport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organization_id;
    const userId = (req as any).user?.id;

    const service = getService(req);
    const result = await service.processImport(orgId, id as string, userId);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getDatasetProvenance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const orgId = (req as any).user?.organization_id;

    const service = getService(req);
    const result = await service.getDatasetProvenance(orgId, id as string);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};
export const runAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.organization_id;
    const context = req.body;

    const service = getService(req);
    const result = await service.runAnalysis(orgId, context);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const getCountryDeepDive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.organization_id;
    const { iso } = req.params;
    const context = req.body;

    const service = getService(req);
    const result = await service.getCountryDeepDive(orgId, iso as string, context);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const exportAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.organization_id;
    const userId = (req as any).user?.id;
    const config = req.body;

    const service = getService(req);
    const buffer = await service.generateExport(orgId, userId, config);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Market_Intelligence_Export_${Date.now()}.xlsx"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const getDiagnostics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.organization_id;
    const { datasetVersionId } = req.params;

    const service = getService(req);
    const result = await service.getDatasetDiagnostics(orgId, datasetVersionId as string);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    next(error);
  }
};

export const listDatasets = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = (req as any).user?.organization_id;
    const service = getService(req);
    const datasets = await service.listDatasets(orgId);

    res.json({
      status: 'success',
      data: datasets
    });
  } catch (error) {
    next(error);
  }
};
