import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { loadUserContext, requirePermission } from '../middleware/permission.middleware';

const router = Router();

// Enforce authentication & load user context for all product endpoints
router.use(requireAuth);
router.use(loadUserContext);

// --- Master Reference Endpoints ---
router.get(
  '/references/dosage-forms',
  requirePermission('products.read'),
  ProductController.getDosageForms
);
router.get(
  '/references/routes',
  requirePermission('products.read'),
  ProductController.getRoutes
);
router.get(
  '/references/strength-units',
  requirePermission('products.read'),
  ProductController.getStrengthUnits
);
router.get(
  '/references/countries',
  requirePermission('products.read'),
  ProductController.getCountries
);
router.get(
  '/references/therapeutic-categories',
  requirePermission('products.read'),
  ProductController.getTherapeuticCategories
);
router.get(
  '/references/molecules',
  requirePermission('products.read'),
  ProductController.getMolecules
);
router.post(
  '/references/molecules',
  requirePermission('products.create'),
  ProductController.createCustomMolecule
);

// --- Product Catalog Endpoints ---
router.post(
  '/',
  requirePermission('products.create'),
  ProductController.createProduct
);
router.get(
  '/',
  requirePermission('products.read'),
  ProductController.getProducts
);
router.get(
  '/analytics',
  requirePermission('products.read'),
  ProductController.getAnalytics
);
router.get(
  '/export',
  requirePermission('products.export'),
  ProductController.exportProducts
);
router.post(
  '/duplicate-check',
  requirePermission('products.read'),
  ProductController.detectDuplicates
);

// --- Single Product Operations ---
router.get(
  '/:id',
  requirePermission('products.read'),
  ProductController.getProductById
);
router.patch(
  '/:id',
  requirePermission('products.update'),
  ProductController.updateProduct
);
router.post(
  '/:id/archive',
  requirePermission('products.archive'),
  ProductController.archiveProduct
);
router.post(
  '/:id/restore',
  requirePermission('products.archive'),
  ProductController.restoreProduct
);

// --- Presentations ---
router.post(
  '/:id/presentations',
  requirePermission('products.manage'),
  ProductController.addPresentation
);
router.delete(
  '/:id/presentations/:presentationId',
  requirePermission('products.manage'),
  ProductController.deletePresentation
);

// --- Company / Partner Relationships ---
router.post(
  '/:id/companies',
  requirePermission('products.manage'),
  ProductController.addCompany
);
router.delete(
  '/:id/companies/:companyId',
  requirePermission('products.manage'),
  ProductController.deleteCompany
);

// --- Target Countries ---
router.post(
  '/:id/countries',
  requirePermission('products.manage'),
  ProductController.addCountry
);
router.delete(
  '/:id/countries/:countryId',
  requirePermission('products.manage'),
  ProductController.deleteCountry
);

// --- Aliases & Brand Names ---
router.post(
  '/:id/aliases',
  requirePermission('products.manage'),
  ProductController.addAlias
);
router.delete(
  '/:id/aliases/:aliasId',
  requirePermission('products.manage'),
  ProductController.deleteAlias
);

export default router;
