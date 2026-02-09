import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { ScreenshotService } from './screenshot.service.js';

/**
 * Request validation schema for report generation (Kotlin mode: report=true)
 */
const GenerateReportRequestSchema = z.object({
  dashboardId: z.string().uuid('Invalid dashboard ID format'),
  authToken: z.string().min(1, 'Auth token is required'),
  backendApiUrl: z.string().url('Invalid backend URL format'),
  frontendUrl: z.string().url().optional(),
  timeout: z.number().int().positive().optional(),
});

/**
 * Request validation schema for data capture (Kotlin mode: data-capture=true)
 */
const CaptureDataRequestSchema = z.object({
  dashboardId: z.string().uuid('Invalid dashboard ID format'),
  authToken: z.string().min(1, 'Auth token is required'),
  backendApiUrl: z.string().url('Invalid backend URL format'),
  frontendUrl: z.string().url().optional(),
  timeout: z.number().int().positive().optional(),
});

// Request type inference from Zod schemas
// type GenerateReportRequest = z.infer<typeof GenerateReportRequestSchema>;
// type CaptureDataRequest = z.infer<typeof CaptureDataRequestSchema>;

/**
 * Modern Express server for report generation using Playwright.
 *
 * **MATCHES KOTLIN BACKEND SPECS EXACTLY**
 *
 * **Endpoints**:
 * - POST /generate-report - Generate PDF report (mode: report)
 * - POST /capture-data - Capture dashboard data (mode: data-capture)
 * - GET /health - Health check endpoint
 *
 * **Modes (matching Kotlin backend):**
 * 1. Report Generation (`report=true`):
 *    - Waits for `eta-dashboard[class*="initialized"]`
 *    - Generates PDF
 *    - Used for user-facing reports
 *
 * 2. Data Capture (`data-capture=true`):
 *    - Waits for `eta-public-data-captured` element
 *    - Triggers frontend data capture
 *    - Used for public dashboard snapshots
 *
 * @see FRONTEND_INTEGRATION_SPEC.md
 */

const PORT = process.env.PORT || 3001;
const app = express();

// Global screenshot service instance
const screenshotService = new ScreenshotService();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  // CORS - configure appropriately for production
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  // Allow all headers including custom Angular headers like x-etalytics-component
  res.header('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
});

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'eta-reporting-service',
    version: '1.0.0',
    browser: screenshotService.isReady() ? 'ready' : 'initializing',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Generate PDF report endpoint
 * Kotlin equivalent: mode=report
 * Waits for: eta-dashboard[class*="initialized"]
 */
app.post('/generate-report', async (req: Request, res: Response) => {
  const requestId = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${requestId}] GENERATE REPORT REQUEST`);
  console.log(`${'='.repeat(60)}`);

  try {
    console.log(`[${requestId}] Body:`, JSON.stringify(req.body, null, 2));

    // Validate request
    const validationResult = GenerateReportRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log(
        `[${requestId}] ❌ Validation failed:`,
        validationResult.error.errors,
      );
      res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
      return;
    }

    const request = validationResult.data;
    const startTime = Date.now();
    console.log(`[${requestId}] 🚀 Starting report generation...`);

    const result = await screenshotService.capture({
      ...request,
      mode: 'report',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${requestId}] ✅ SUCCESS: ${result.filename} (${duration}s)`);
    console.log(
      `[${requestId}] File size: ${(result.data.length / 1024).toFixed(2)} KB`,
    );
    console.log(`${'='.repeat(60)}\n`);

    // Send PDF
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.setHeader('Content-Length', result.data.length);
    res.send(result.data);
  } catch (error) {
    console.error(`[${requestId}] ❌ ERROR:`, error);
    console.log(`${'='.repeat(60)}\n`);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Report generation failed',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * Capture dashboard data endpoint
 * Kotlin equivalent: mode=data-capture
 * Waits for: eta-public-data-captured element
 */
app.post('/capture-data', async (req: Request, res: Response) => {
  const requestId = Date.now();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${requestId}] CAPTURE DATA REQUEST`);
  console.log(`${'='.repeat(60)}`);

  try {
    console.log(`[${requestId}] Body:`, JSON.stringify(req.body, null, 2));

    // Validate request
    const validationResult = CaptureDataRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      console.log(
        `[${requestId}] ❌ Validation failed:`,
        validationResult.error.errors,
      );
      res.status(400).json({
        error: 'Invalid request',
        details: validationResult.error.errors,
      });
      return;
    }

    const request = validationResult.data;
    const startTime = Date.now();
    console.log(`[${requestId}] 🚀 Starting data capture...`);

    await screenshotService.capture({
      ...request,
      mode: 'data-capture',
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${requestId}] ✅ SUCCESS: Data captured (${duration}s)`);
    console.log(`${'='.repeat(60)}\n`);

    // Return success response (no file download for data capture)
    res.json({
      success: true,
      message: 'Data capture completed',
      duration: `${duration}s`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[${requestId}] ❌ ERROR:`, error);
    console.log(`${'='.repeat(60)}\n`);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      error: 'Data capture failed',
      message: errorMessage,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * 404 handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist',
  });
});

/**
 * Global error handler
 */
app.use((err: Error, _req: Request, res: Response) => {
  console.error('[Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

/**
 * Start the server
 */
async function startServer() {
  try {
    console.log('[Server] Initializing browser...');
    await screenshotService.initialize();
    console.log('[Server] Browser initialized successfully');

    app.listen(PORT, () => {
      console.log(`[Server] Reporting service running on port ${PORT}`);
      console.log(`[Server] Health check: http://localhost:${PORT}/health`);
      console.log(
        `[Server] Generate report: http://localhost:${PORT}/generate-report`,
      );
      console.log(
        `[Server] Capture data: http://localhost:${PORT}/capture-data`,
      );
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received, shutting down gracefully...');
  await screenshotService.cleanup();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Server] SIGINT received, shutting down gracefully...');
  await screenshotService.cleanup();
  process.exit(0);
});

// Start the server
startServer();
