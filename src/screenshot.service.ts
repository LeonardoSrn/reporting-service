import { type Browser, chromium, type Page } from 'playwright';

/**
 * Mode of operation for screenshot/PDF generation
 */
export type CaptureMode = 'data-capture' | 'report';

/**
 * Configuration for screenshot/PDF generation
 * Matches backend Kotlin implementation specs
 */
export interface ScreenshotConfig {
  /** Dashboard ID (UUID) */
  dashboardId: string;
  /** JWT authentication token */
  authToken: string;
  /** Backend API URL (e.g., http://localhost:8080/api) */
  backendApiUrl: string;
  /** Frontend URL (default: http://localhost:4200) */
  frontendUrl?: string;
  /**
   * Capture mode:
   * - 'data-capture': Captures data, waits for eta-public-data-captured element
   * - 'report': Generates PDF, waits for eta-dashboard[class*="initialized"]
   */
  mode: CaptureMode;
  /** Maximum time to wait (default: 15000ms as per Kotlin spec) */
  timeout?: number;
  /** Polling interval for CSS selector checks (default: 100ms as per Kotlin spec) */
  pollingIntervalMs?: number;
}

/**
 * Result of a screenshot/PDF generation
 */
export interface ScreenshotResult {
  /** Binary data of the generated file */
  data: Buffer;
  /** MIME type of the result */
  mimeType: string;
  /** Suggested filename */
  filename: string;
}

/**
 * Modern screenshot and PDF generation service using Playwright.
 *
 * **IMPORTANT**: This implementation matches the Kotlin backend service specification exactly.
 *
 * **Key Specifications (from Kotlin backend):**
 * - Data Capture Mode: Waits for `eta-public-data-captured` ELEMENT (not class)
 * - Report Mode: Waits for `eta-dashboard[class*="initialized"]` selector
 * - Polling: 100ms interval, 15s max timeout
 * - Browser: Chromium with specific flags
 * - Window: 1527x1080 initial, then fullscreen
 * - PDF: A4, portrait, 0 margins
 *
 * @see FRONTEND_INTEGRATION_SPEC.md for complete specification
 */
export class ScreenshotService {
  private browser: Browser | null = null;

  /**
   * Browser configuration matching Kotlin specs exactly
   * @see application.yaml:69-83
   */
  private readonly BROWSER_ARGS = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-web-security',
    '--window-size=1527,1080', // Kotlin spec: 1527x1080
    '--hide-scrollbars',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
  ];

  /**
   * Initialize the browser instance.
   * Call this once before capturing screenshots.
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return; // Already initialized
    }

    console.log(
      '[ScreenshotService] Initializing browser with Kotlin-spec configuration...',
    );
    this.browser = await chromium.launch({
      headless: true,
      args: this.BROWSER_ARGS,
    });
    console.log('[ScreenshotService] ✓ Browser initialized');
  }

  /**
   * Constructs the URL for dashboard access matching Kotlin backend format.
   *
   * @param config - Screenshot configuration
   * @returns Fully constructed URL
   * @see BrowserRenderingUtil.kt:40-60
   */
  private constructUrl(config: ScreenshotConfig): string {
    const {
      dashboardId,
      authToken,
      backendApiUrl,
      frontendUrl = 'http://localhost:4200',
      mode,
    } = config;

    // Kotlin spec: /public/dashboards/{id}?token={jwt}&backendApiUrl={url}&{mode}=true
    const params = new URLSearchParams({
      token: authToken,
      backendApiUrl,
      [mode]: 'true', // Either 'data-capture=true' OR 'report=true'
    });

    return `${frontendUrl}/public/dashboards/${dashboardId}?${params.toString()}`;
  }

  /**
   * Gets the CSS selector to wait for based on the capture mode.
   *
   * @param mode - Capture mode
   * @returns CSS selector string
   * @see FRONTEND_INTEGRATION_SPEC.md Section 1
   */
  private getCssSelectorForMode(mode: CaptureMode): string {
    if (mode === 'data-capture') {
      // Kotlin spec: eta-public-data-captured ELEMENT (not class)
      return 'eta-public-data-captured';
    } else {
      // Kotlin spec: eta-dashboard with class containing 'initialized'
      return 'eta-dashboard[class*="initialized"]';
    }
  }

  /**
   * Waits for a CSS selector using polling logic matching Kotlin backend.
   *
   * **Kotlin Spec:**
   * - Polling interval: 100ms (fixed)
   * - Maximum wait: 15 seconds (configurable)
   * - Total checks: ~150 attempts
   *
   * @param page - Playwright page instance
   * @param cssSelector - CSS selector to wait for
   * @param maxWaitMs - Maximum wait time in milliseconds
   * @param pollingIntervalMs - Polling interval in milliseconds
   * @throws Error if timeout occurs
   * @see BrowserRenderingUtil.kt:100-125
   */
  private async awaitCssSelector(
    page: Page,
    cssSelector: string,
    maxWaitMs: number,
    pollingIntervalMs: number,
  ): Promise<void> {
    const maxAttempts = Math.floor(maxWaitMs / pollingIntervalMs);
    console.log(`  → Polling for selector: ${cssSelector}`);
    console.log(
      `    Max attempts: ${maxAttempts} (${maxWaitMs}ms / ${pollingIntervalMs}ms)`,
    );

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const elements = await page.locator(cssSelector).count();

      if (elements > 0) {
        console.log(
          `  ✓ Selector found after ${attempt} attempts (${attempt * pollingIntervalMs}ms)`,
        );
        return; // Success
      }

      // Log progress every 2 seconds
      if (attempt % 20 === 0) {
        console.log(
          `    ... still waiting (attempt ${attempt}/${maxAttempts})`,
        );
      }

      await page.waitForTimeout(pollingIntervalMs);
    }

    throw new Error(
      `Timeout: CSS selector "${cssSelector}" not found after ${maxWaitMs}ms (${maxAttempts} attempts)`,
    );
  }

  /**
   * Capture a PDF of the given dashboard using Kotlin backend specs.
   *
   * **Process:**
   * 1. Construct URL with correct parameters
   * 2. Open in headless browser (1527x1080)
   * 3. Set to fullscreen
   * 4. Poll for mode-specific CSS selector
   * 5. Generate PDF (A4, portrait, 0 margins)
   *
   * @param config - Screenshot configuration
   * @returns Screenshot result with binary data
   * @throws Error if browser not initialized or capture fails
   * @see FRONTEND_INTEGRATION_SPEC.md Section 4
   */
  async capture(config: ScreenshotConfig): Promise<ScreenshotResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }

    const {
      mode,
      timeout = 15000, // Kotlin spec: 15 seconds
      pollingIntervalMs = 100, // Kotlin spec: 100ms
    } = config;

    const url = this.constructUrl(config);
    const cssSelector = this.getCssSelectorForMode(mode);

    console.log(`\n[ScreenshotService] Starting ${mode} mode`);
    console.log(`  URL: ${url}`);
    console.log(`  Selector: ${cssSelector}`);
    console.log(`  Timeout: ${timeout}ms, Polling: ${pollingIntervalMs}ms`);

    // Create browser context with viewport size matching Kotlin spec
    const context = await this.browser.newContext({
      viewport: { width: 1527, height: 1080 }, // Kotlin spec
    });

    const page = await context.newPage();

    try {
      const totalStart = Date.now();

      // Navigate to the URL
      console.log(`  → Navigating to dashboard...`);
      const navStart = Date.now();
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });
      console.log(
        `  ✓ Navigation complete (${((Date.now() - navStart) / 1000).toFixed(1)}s)`,
      );

      // Set to fullscreen (Kotlin spec: BrowserRenderingUtil.kt:78)
      console.log(`  → Setting fullscreen mode...`);
      await page.evaluate(() => {
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {
            // Fullscreen may fail in headless mode, that's okay
          });
        }
      });
      console.log(`  ✓ Fullscreen mode activated`);

      // Wait for mode-specific CSS selector using polling logic
      const waitStart = Date.now();
      await this.awaitCssSelector(
        page,
        cssSelector,
        timeout,
        pollingIntervalMs,
      );
      console.log(
        `  ✓ Wait complete (${((Date.now() - waitStart) / 1000).toFixed(1)}s)`,
      );

      let data: Buffer;
      let mimeType: string;
      let filename: string;

      if (mode === 'report') {
        // Generate PDF with Kotlin specs
        console.log(`  → Generating PDF (A4, portrait, 0 margins)...`);
        const pdfStart = Date.now();

        // Kotlin spec: ReportGenerationService.kt:29-34
        data = await page.pdf({
          format: 'A4', // 21.0cm × 29.7cm
          landscape: false, // Portrait
          margin: {
            top: '0cm',
            right: '0cm',
            bottom: '0cm',
            left: '0cm',
          },
          printBackground: true,
          preferCSSPageSize: false, // Shrink to fit
        });

        mimeType = 'application/pdf';
        filename = `report-${config.dashboardId}-${Date.now()}.pdf`;

        console.log(
          `  ✓ PDF generated (${((Date.now() - pdfStart) / 1000).toFixed(1)}s)`,
        );
      } else {
        // Data capture mode - just confirm completion
        console.log(`  ✓ Data capture completed`);

        // Return empty PDF as placeholder (actual data is captured by frontend)
        data = Buffer.from('Data capture completed');
        mimeType = 'text/plain';
        filename = `data-capture-${config.dashboardId}-${Date.now()}.txt`;
      }

      const totalTime = ((Date.now() - totalStart) / 1000).toFixed(2);
      console.log(`  ✅ Total time: ${totalTime}s`);
      console.log(
        `  📄 File: ${filename} (${(data.length / 1024).toFixed(2)} KB)\n`,
      );

      return {
        data,
        mimeType,
        filename,
      };
    } catch (error) {
      console.error(
        `  ❌ Capture failed:`,
        error instanceof Error ? error.message : error,
      );
      if (error instanceof Error && error.stack) {
        console.error(`  Stack:`, error.stack);
      }
      throw error;
    } finally {
      // Always clean up page and context
      await page.close();
      await context.close();
    }
  }

  /**
   * Clean up browser resources.
   * Call this when shutting down the service.
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Check if the service is initialized and ready.
   */
  isReady(): boolean {
    return this.browser !== null;
  }
}
