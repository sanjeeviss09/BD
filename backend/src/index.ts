import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import organizationRoutes from './routes/organization.routes';
import userRoutes from './routes/user.routes';
import { correlationIdMiddleware } from './middleware/correlation.middleware';
import { errorHandler } from './middleware/error.middleware';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Security Middlewares
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

// Rate Limiting
const isDev = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: isDev ? 10000 : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later.' } },
  skip: (req) => {
    // In local development or for file template downloads, don't throttle
    if (isDev) return true;
    return req.path.includes('/template/download');
  },
});
app.use('/api/', limiter);

// Request Tracking
app.use(correlationIdMiddleware);

// Routes
import authRoutes from './routes/auth.routes';
import roleRoutes from './routes/role.routes';
import permissionRoutes from './routes/permission.routes';
import configurationRoutes from './routes/configuration.routes';
import taskRoutes from './routes/task.routes';
import productRoutes from './routes/product.routes';
import opportunityRoutes from './routes/opportunity.routes';
import workflowRoutes from './routes/workflow.routes';
import marketDataRoutes from './routes/market-data.routes';
import rfqRoutes from './routes/rfq.routes';
import regulatoryRoutes from './routes/regulatory.routes';
import commercialEvaluationRoutes from './routes/commercial-evaluation.routes';
import intelligenceRoutes from './routes/intelligence.routes';
import { meetingRoutes } from './routes/meeting.routes';
import responsibilityRoutes from './routes/responsibility.routes';
import customerIntelligenceRoutes from './routes/customer-intelligence.routes';
import productionFeasibilityRoutes from './routes/production-feasibility.routes';
import departmentRoutes from './routes/department.routes';
import { notificationRoutes } from './routes/notification.routes';
import aiOrchestratorRoutes from './routes/ai-orchestrator.routes';
import { MeetingReminderSchedulerService } from './services/meeting-reminder-scheduler.service';

app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/configuration', configurationRoutes);
app.use('/api/responsibility', responsibilityRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/products', productRoutes);
app.use('/api/opportunities', opportunityRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/market-data', marketDataRoutes);
app.use('/api/rfqs', rfqRoutes);
app.use('/api/regulatory', regulatoryRoutes);
app.use('/api/commercial-evaluations', commercialEvaluationRoutes);
app.use('/api/intelligence', intelligenceRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/customer-intelligence', customerIntelligenceRoutes);
app.use('/api/production-feasibility', productionFeasibilityRoutes);
app.use('/api/production', productionFeasibilityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/ai', aiOrchestratorRoutes);

app.get('/api/customers', (req: Request, res: Response) => {
  const customers = [
    { id: 'c1000000-0000-0000-0000-000000000001', name: 'Novo Nordisk A/S', tier: 'Tier 1 Global Sponsor', country: 'Denmark' },
    { id: 'c1000000-0000-0000-0000-000000000002', name: 'Sanofi SA', tier: 'Tier 1 Global CDMO Client', country: 'France' },
    { id: 'c1000000-0000-0000-0000-000000000003', name: 'AstraZeneca PLC', tier: 'Tier 1 Global Pharma', country: 'United Kingdom' },
    { id: 'c1000000-0000-0000-0000-000000000004', name: 'Novartis AG', tier: 'Strategic Partner', country: 'Switzerland' },
    { id: 'c1000000-0000-0000-0000-000000000005', name: 'Pfizer Global Supply', tier: 'Tier 1 Global Sponsor', country: 'United States' },
    { id: 'c1000000-0000-0000-0000-000000000006', name: 'F. Hoffmann-La Roche Ltd', tier: 'Strategic Partner', country: 'Switzerland' },
    { id: 'c1000000-0000-0000-0000-000000000007', name: 'GSK Commercial Operations', tier: 'Commercial Partner', country: 'United Kingdom' },
  ];
  res.json({ data: customers, customers });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error Handling (Must be last)
app.use(errorHandler);

app.listen(port, () => {
  logger.info(`BDIQ Backend running on port ${port}`);
  // Start background meeting reminder scheduler
  MeetingReminderSchedulerService.startScheduler(60000);
});

