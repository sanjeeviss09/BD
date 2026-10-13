import { Request, Response } from 'express';
import { z } from 'zod';
import { ProductService } from '../services/product.service';
import { ProductReferenceService } from '../services/product-reference.service';
import { createSupabaseClientForUser } from '../db/supabase';

// Helper to extract Zod errors safely across Zod versions
const extractValidationErrors = (err: any) => err.issues || err.errors || [];

const createProductSchema = z.object({
  product_name: z.string().min(1, 'Product name is required'),
  generic_name: z.string().optional(),
  brand_name: z.string().optional(),
  molecule_id: z.string().uuid().optional(),
  product_type: z.string().optional(),
  product_category: z.string().optional(),
  dosage_form_id: z.string().uuid().optional(),
  strength_value: z.number().nonnegative().optional(),
  strength_unit_id: z.string().uuid().optional(),
  strength_raw: z.string().optional(),
  route_id: z.string().uuid().optional(),
  therapeutic_category_id: z.string().uuid().optional(),
  originator_company: z.string().optional(),
  reference_product: z.string().optional(),
  description: z.string().optional(),
  lifecycle_status: z.string().optional(),
  development_status: z.string().optional(),
  country_of_origin: z.string().optional(),
  forceCreate: z.boolean().optional(),
});

const updateProductSchema = z.object({
  product_name: z.string().min(1).optional(),
  generic_name: z.string().optional(),
  brand_name: z.string().optional(),
  molecule_id: z.string().uuid().optional(),
  product_type: z.string().optional(),
  product_category: z.string().optional(),
  dosage_form_id: z.string().uuid().optional(),
  strength_value: z.number().nonnegative().optional(),
  strength_unit_id: z.string().uuid().optional(),
  strength_raw: z.string().optional(),
  route_id: z.string().uuid().optional(),
  therapeutic_category_id: z.string().uuid().optional(),
  originator_company: z.string().optional(),
  reference_product: z.string().optional(),
  description: z.string().optional(),
  lifecycle_status: z.string().optional(),
  development_status: z.string().optional(),
  country_of_origin: z.string().optional(),
  version: z.number().int().nonnegative('Version is required for optimistic locking'),
});

const archiveSchema = z.object({
  reason: z.string().min(3, 'Archive reason must be at least 3 characters'),
});

const duplicateCheckSchema = z.object({
  productName: z.string().min(1),
  genericName: z.string().optional(),
  brandName: z.string().optional(),
  moleculeId: z.string().uuid().optional(),
  dosageFormId: z.string().uuid().optional(),
  strengthValue: z.number().optional(),
  routeId: z.string().uuid().optional(),
  countryOfOrigin: z.string().optional(),
});

const presentationSchema = z.object({
  presentation_name: z.string().min(1, 'Presentation name is required'),
  presentation_code: z.string().optional(),
  pack_size: z.number().int().positive().optional(),
  pack_unit: z.string().optional(),
  packaging_type: z.string().optional(),
  description: z.string().optional(),
});

const companySchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  relationship_type: z.string().min(1, 'Relationship type is required'),
  country_code: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  is_current: z.boolean().optional(),
  notes: z.string().optional(),
});

const countrySchema = z.object({
  country_code: z.string().min(2, 'Country code is required'),
  country_id: z.string().uuid().optional(),
  market_status: z.string().optional(),
  availability_status: z.string().optional(),
  expected_launch_date: z.string().optional(),
  actual_launch_date: z.string().optional(),
  notes: z.string().optional(),
});

const aliasSchema = z.object({
  alias_value: z.string().min(1, 'Alias value is required'),
  alias_type: z.string().min(1, 'Alias type is required'),
  country_code: z.string().optional(),
  source: z.string().optional(),
});

const customMoleculeSchema = z.object({
  canonicalName: z.string().min(1, 'Canonical molecule name is required'),
  casNumber: z.string().optional(),
  description: z.string().optional(),
});

export class ProductController {
  private static getServices(req: Request) {
    const supabase = createSupabaseClientForUser(req);
    const orgId = (req as any).user?.organization_id;
    const userId = (req as any).user?.id;

    if (!orgId || !userId) {
      throw new Error('Unauthorized: Missing user or organization context');
    }

    return {
      productService: new ProductService(supabase, orgId, userId),
      referenceService: new ProductReferenceService(supabase),
      orgId,
      userId,
    };
  }

  public static async createProduct(req: Request, res: Response) {
    try {
      const parsed = createProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const { productService } = ProductController.getServices(req);
      const result = await productService.createProduct(parsed.data);

      if (result.duplicateWarning) {
        return res.status(200).json({
          warning: 'POTENTIAL_DUPLICATES_DETECTED',
          message: 'Potential duplicate pharmaceutical products detected in catalog',
          duplicateDetection: result.duplicateWarning,
        });
      }

      return res.status(201).json({ data: result.product });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getProducts(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      const {
        page,
        limit,
        search,
        lifecycle_status,
        product_type,
        product_category,
        dosage_form_id,
        route_id,
        therapeutic_category_id,
        country_code,
        include_archived,
        sort_by,
        sort_order,
      } = req.query;

      const result = await productService.getProducts({
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        search: search as string,
        lifecycle_status: lifecycle_status as string,
        product_type: product_type as string,
        product_category: product_category as string,
        dosage_form_id: dosage_form_id as string,
        route_id: route_id as string,
        therapeutic_category_id: therapeutic_category_id as string,
        country_code: country_code as string,
        include_archived: include_archived === 'true',
        sort_by: sort_by as string,
        sort_order: sort_order as 'asc' | 'desc',
      });

      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getProductById(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      const product = await productService.getProductById(req.params.id as string);
      return res.json({ data: product });
    } catch (err: any) {
      return res.status(404).json({ error: err.message });
    }
  }

  public static async updateProduct(req: Request, res: Response) {
    try {
      const parsed = updateProductSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const { productService } = ProductController.getServices(req);
      const updated = await productService.updateProduct(req.params.id as string, parsed.data);
      return res.json({ data: updated });
    } catch (err: any) {
      if (err.message.includes('Concurrent modification')) {
        return res.status(409).json({ error: err.message });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  public static async archiveProduct(req: Request, res: Response) {
    try {
      const parsed = archiveSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const { productService } = ProductController.getServices(req);
      const archived = await productService.archiveProduct(req.params.id as string, parsed.data.reason);
      return res.json({ data: archived });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async restoreProduct(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      const restored = await productService.restoreProduct(req.params.id as string);
      return res.json({ data: restored });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async detectDuplicates(req: Request, res: Response) {
    try {
      const parsed = duplicateCheckSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }

      const { productService } = ProductController.getServices(req);
      const result = await productService.detectDuplicates(parsed.data);
      return res.json({ data: result });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getAnalytics(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      const analytics = await productService.getDashboardAnalytics();
      return res.json({ data: analytics });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async exportProducts(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      const csv = await productService.exportProducts(req.query);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=products_export.csv');
      return res.send(csv);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Presentations
  public static async addPresentation(req: Request, res: Response) {
    try {
      const parsed = presentationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const { productService } = ProductController.getServices(req);
      const data = await productService.addPresentation(req.params.id as string, parsed.data);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async deletePresentation(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      await productService.deletePresentation(req.params.id as string, req.params.presentationId as string);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Company Relationships
  public static async addCompany(req: Request, res: Response) {
    try {
      const parsed = companySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const { productService } = ProductController.getServices(req);
      const data = await productService.addCompanyRelationship(req.params.id as string, parsed.data);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async deleteCompany(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      await productService.deleteCompanyRelationship(req.params.id as string, req.params.companyId as string);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Countries
  public static async addCountry(req: Request, res: Response) {
    try {
      const parsed = countrySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const { productService } = ProductController.getServices(req);
      const data = await productService.addCountryRelationship(req.params.id as string, parsed.data);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async deleteCountry(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      await productService.deleteCountryRelationship(req.params.id as string, req.params.countryId as string);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Aliases
  public static async addAlias(req: Request, res: Response) {
    try {
      const parsed = aliasSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const { productService } = ProductController.getServices(req);
      const data = await productService.addAlias(req.params.id as string, parsed.data);
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async deleteAlias(req: Request, res: Response) {
    try {
      const { productService } = ProductController.getServices(req);
      await productService.deleteAlias(req.params.id as string, req.params.aliasId as string);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Master References
  public static async getDosageForms(req: Request, res: Response) {
    try {
      const { referenceService } = ProductController.getServices(req);
      const data = await referenceService.getDosageForms();
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getRoutes(req: Request, res: Response) {
    try {
      const { referenceService } = ProductController.getServices(req);
      const data = await referenceService.getRoutes();
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getStrengthUnits(req: Request, res: Response) {
    try {
      const { referenceService } = ProductController.getServices(req);
      const data = await referenceService.getStrengthUnits();
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getCountries(req: Request, res: Response) {
    try {
      const { referenceService } = ProductController.getServices(req);
      const data = await referenceService.getCountries();
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getTherapeuticCategories(req: Request, res: Response) {
    try {
      const { referenceService } = ProductController.getServices(req);
      const data = await referenceService.getTherapeuticCategories();
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async getMolecules(req: Request, res: Response) {
    try {
      const { referenceService, orgId } = ProductController.getServices(req);
      const search = req.query.search as string;
      const data = await referenceService.getMolecules(search, orgId);
      return res.json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  public static async createCustomMolecule(req: Request, res: Response) {
    try {
      const parsed = customMoleculeSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: extractValidationErrors(parsed.error) });
      }
      const { referenceService, orgId } = ProductController.getServices(req);
      const data = await referenceService.createCustomMolecule(
        orgId,
        parsed.data.canonicalName,
        parsed.data.casNumber,
        parsed.data.description
      );
      return res.status(201).json({ data });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}
