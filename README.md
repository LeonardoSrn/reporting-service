# etaONE Reporting Service

A modern, self-contained PDF/screenshot generation service using Playwright for
headless browser automation.

## 🎯 Purpose

This service replaces the broken SpringBoot + Chromium backend reporting system
with a clean, maintainable solution that we fully control. It generates PDF
reports by:

1. Opening Angular dashboards with `?data-capture=true` parameter
2. Waiting for the `.eta-public-data-captured` CSS class (signals data is ready)
3. Capturing a screenshot or PDF of the fully rendered page

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (required)
- pnpm (package manager)

### Local Development

```bash
# Navigate to the service directory
cd reporting-service

# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium

# Start development server (auto-restart on changes)
pnpm dev

# Server runs on http://localhost:3001
```

### Testing the Service

```bash
# Health check
curl http://localhost:3001/health

# Generate a PDF (replace with your actual dashboard URL and token)
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "url": "http://localhost:4200/dashboards/123?data-capture=true",
    "format": "pdf",
    "timeout": 60000
  }' \
  --output report.pdf
```

## 🏗️ Architecture

### Components

1. **ScreenshotService** (`src/screenshot.service.ts`)
   - Core Playwright integration
   - Browser lifecycle management
   - Screenshot/PDF generation logic

2. **Express Server** (`src/server.ts`)
   - REST API endpoints
   - Request validation with Zod
   - Error handling and logging
   - OAuth token forwarding

3. **Docker Support**
   - Dockerfile with Playwright dependencies
   - Docker Compose for easy deployment
   - Health checks and resource management

### API Endpoints

#### `POST /generate`

Generates a PDF or screenshot from a URL.

**Request Body:**

```json
{
  "url": "https://app.etaone.io/dashboards/123?data-capture=true",
  "format": "pdf",
  "timeout": 60000,
  "width": 1920,
  "height": 1080,
  "waitForClass": "eta-public-data-captured"
}
```

**Headers:**

- `Authorization: Bearer <token>` - JWT token (forwarded to dashboard URL)
- `Content-Type: application/json`

**Response:**

- Success: Binary PDF/PNG file
- Error: JSON error object

#### `GET /health`

Health check endpoint.

**Response:**

```json
{
  "status": "ok",
  "service": "eta-reporting-service",
  "version": "1.0.0",
  "browser": "ready",
  "timestamp": "2024-02-09T12:00:00.000Z"
}
```

## 🐳 Docker Deployment

### Build and Run

```bash
# Build the image
docker build -t eta-reporting-service .

# Run with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
PORT=3001
DEFAULT_TIMEOUT=60000
DEFAULT_WIDTH=1920
DEFAULT_HEIGHT=1080
```

### Production Deployment

For production, you may want to:

1. **Update CORS settings** in `src/server.ts`
2. **Configure environment variables** via `.env` or container orchestration
3. **Set up reverse proxy** (nginx, Traefik) for SSL termination
4. **Monitor resource usage** (Chromium can be memory-intensive)
5. **Scale horizontally** if needed (stateless service)

## 🔧 Configuration

### Frontend Integration

The Angular app automatically uses the reporting service when generating
reports. The service URL is configured in `ReportService`:

```typescript
// Default: http://localhost:3001
// Production: Set window.REPORTING_SERVICE_URL in index.html or env config
const REPORTING_SERVICE_URL = window.REPORTING_SERVICE_URL || 'http://localhost:3001';
```

For production deployment, add to your `index.html`:

```html
<script>
  window.REPORTING_SERVICE_URL = 'https://reporting.your-domain.com';
</script>
```

### Timeout Configuration

The service has multiple timeout layers:

1. **Browser navigation**: 60s default (configurable via request)
2. **CSS class wait**: Same as navigation timeout
3. **Extra render time**: 1s after class appears (hardcoded)

Adjust these in `src/screenshot.service.ts` if needed.

## 📊 Monitoring

### Health Checks

The service includes built-in health checks:

```bash
# Docker health check (automatic)
docker-compose ps

# Manual check
curl http://localhost:3001/health
```

### Logs

All operations are logged to stdout:

```bash
# Local development
pnpm dev

# Docker logs
docker-compose logs -f reporting-service
```

Log format:

```
[2024-02-09T12:00:00.000Z] POST /generate
[ScreenshotService] Navigating to: https://...
[ScreenshotService] Waiting for class: eta-public-data-captured
[ScreenshotService] Capturing PDF...
[ScreenshotService] Capture complete: report-1707480000000.pdf
```

## 🧪 Testing

### Manual Testing

1. Start the Angular app with data capture mode enabled:

   ```bash
   # In main project directory
   pnpm start
   ```

2. Start the reporting service:

   ```bash
   # In reporting-service directory
   pnpm dev
   ```

3. Generate a report from the Angular UI (Reports → Generate Report)

### Automated Testing

```bash
# Run tests (if implemented)
pnpm test
```

## 🐛 Troubleshooting

### Common Issues

1. **"Browser not initialized" error**
   - Ensure Playwright browsers are installed:
     `pnpm exec playwright install chromium`

2. **Timeout waiting for CSS class**
   - Check that dashboard data capture is working
   - Look for `.eta-public-data-captured` class in browser DevTools
   - Increase timeout in request

3. **403/401 errors when accessing dashboard**
   - Ensure auth token is being passed correctly
   - Check token expiration
   - Verify dashboard permissions

4. **Docker container crashes**
   - Increase `shm_size` in docker-compose.yml
   - Check memory limits
   - Review logs: `docker-compose logs reporting-service`

### Debug Mode

Enable verbose logging by modifying `src/server.ts`:

```typescript
// Add more detailed logging
console.log('[Generate] Request body:', JSON.stringify(req.body, null, 2));
console.log('[Generate] Auth token:', authToken ? 'present' : 'missing');
```

## 📝 Development Notes

### Why Playwright?

- Modern, actively maintained
- Better API than Puppeteer
- Built-in waiting mechanisms
- Excellent documentation
- Official Docker images

### Code Quality

- **TypeScript**: Full type safety
- **ESM Modules**: Modern JavaScript
- **Zod Validation**: Runtime type checking
- **Express**: Battle-tested HTTP server
- **Well-documented**: Extensive JSDoc comments

### Future Improvements

- [ ] Support multiple dashboards in one PDF (combine pages)
- [ ] PNG screenshot support
- [ ] Configurable PDF page sizes
- [ ] Screenshot comparison/diff features
- [ ] Caching layer for repeated requests
- [ ] Metrics/observability (Prometheus, etc.)
- [ ] Rate limiting
- [ ] Queue system for concurrent requests

## 🔗 Related Documentation

- [Playwright Documentation](https://playwright.dev)
- [Express Documentation](https://expressjs.com)
- [Zod Documentation](https://zod.dev)
- [Dashboard Data Capture Flow](../docs/public-dashboards.md)

## 📄 License

Internal use only - etaONE Energy Intelligence Platform

---

**Need help?** Contact the development team or check the main project
documentation.
