# Migration Summary: New Reporting Service

## Overview

Replaced the broken SpringBoot + Chromium backend reporting system with a
modern, self-contained Node.js + Playwright service.

## What Changed

### ✅ New Components

1. **`reporting-service/`** - Complete new service
   - Modern TypeScript + Playwright implementation
   - Express REST API server
   - Docker support
   - Comprehensive documentation

2. **Updated Frontend** -
   `modules/shared/src/lib/resources/reports/service/report.service.ts`
   - Now calls the new reporting service instead of backend
   - Constructs dashboard URLs with `?data-capture=true`
   - Forwards authentication tokens

### 🔄 Architecture Changes

#### Before (Broken):

```
Frontend → Backend API (/reports/{id}/run)
                ↓
       SpringBoot + Chromium (broken)
                ↓
           Screenshot
```

#### After (New):

```
Frontend → ReportService.generateReport()
                ↓
       Fetch report config (dashboard IDs)
                ↓
       Construct dashboard URL + ?data-capture=true
                ↓
       POST to reporting-service/generate
                ↓
       Playwright opens dashboard
                ↓
       Wait for .eta-public-data-captured
                ↓
       Capture PDF → Return to frontend
```

## How It Works

### Data Capture Flow

1. **Frontend Dashboard Loading** (`dashboard-resource.component.ts`)
   - URL: `/dashboards/{id}?data-capture=true`
   - `DashboardDataCaptureService.startCapture()` activates

2. **HTTP Interception** (`dashboard-data-capture.interceptor.ts`)
   - Captures all HTTP responses
   - Stores in memory map (URL → response body)

3. **Wait for Completion**
   - Waits for `allWidgetsRenderingCompleted` signal
   - Uploads captured data to backend
   - Adds `.eta-public-data-captured` CSS class to DOM

4. **Screenshot Service** (NEW - `reporting-service/`)
   - Playwright detects the CSS class
   - Captures PDF of fully rendered page
   - Returns to frontend

### Public Dashboard Flow (Unchanged)

1. **Public View Mode** (`?share=true`)
2. **Load Cached Data** (`public-data.interceptor.ts`)
   - Serves static snapshot instead of API calls
3. **Render Dashboard** with cached data

## Technical Details

### New Service Stack

- **Node.js 20+**: Modern runtime
- **TypeScript**: Type safety
- **Playwright**: Headless browser automation
- **Express**: HTTP server
- **Zod**: Request validation
- **Docker**: Containerization

### Key Features

- ✅ Waits for Angular data capture completion
- ✅ Configurable timeouts and viewport sizes
- ✅ Proper error handling and logging
- ✅ Auth token forwarding
- ✅ Health check endpoint
- ✅ Docker deployment ready
- ✅ Clean, maintainable code
- ✅ Comprehensive documentation

## Deployment

### Local Development

```bash
# Start all services (UI, API, Reporting)
pnpm dev:full

# Or just reporting service
cd reporting-service
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

### Production Deployment

1. **Build Docker image**

   ```bash
   cd reporting-service
   docker build -t eta-reporting-service .
   ```

2. **Run with Docker Compose**

   ```bash
   docker-compose up -d
   ```

3. **Configure frontend**
   - Set `window.REPORTING_SERVICE_URL` in index.html
   - Default: `http://localhost:3001`
   - Production: Your reporting service URL

## Testing

### Quick Test

1. Start services:

   ```bash
   pnpm dev:full
   ```

2. Navigate to Reports in Angular app

3. Click "Generate Report" on any report

4. Wait for PDF download

### Manual API Test

```bash
# Health check
curl http://localhost:3001/health

# Generate PDF
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "url": "http://localhost:4200/dashboards/123?data-capture=true",
    "format": "pdf"
  }' \
  --output test-report.pdf
```

## File Changes

### New Files

- `reporting-service/package.json` - Service dependencies
- `reporting-service/tsconfig.json` - TypeScript config
- `reporting-service/src/server.ts` - Express API server
- `reporting-service/src/screenshot.service.ts` - Playwright integration
- `reporting-service/Dockerfile` - Docker image
- `reporting-service/docker-compose.yml` - Docker Compose config
- `reporting-service/.env.example` - Environment template
- `reporting-service/.gitignore` - Git ignore rules
- `reporting-service/.dockerignore` - Docker ignore rules
- `reporting-service/README.md` - Full documentation
- `reporting-service/QUICKSTART.md` - Quick start guide

### Modified Files

- `modules/shared/src/lib/resources/reports/service/report.service.ts`
  - Updated to call new reporting service
  - Added auth token forwarding
  - Improved error handling

- `package.json`
  - Added `serve:reporting` script
  - Added `dev:full` script (runs all services)

## Benefits

1. **Self-Contained**: No dependency on broken backend service
2. **Modern Stack**: Latest Playwright, TypeScript, Node.js
3. **Better Control**: We own the code and can debug/fix issues
4. **Well Documented**: Clear architecture and usage guides
5. **Docker Ready**: Easy deployment and scaling
6. **Maintainable**: Clean code, proper error handling
7. **Flexible**: Easy to extend for new features

## Troubleshooting

See `reporting-service/README.md` for detailed troubleshooting guide.

Common issues:

- Browser not initialized → Run `pnpm exec playwright install chromium`
- Timeout errors → Check dashboard loading, increase timeout
- Auth errors → Verify JWT token validity
- Docker crashes → Increase `shm_size` in docker-compose.yml

## Next Steps

- [ ] Test with production dashboards
- [ ] Deploy to staging environment
- [ ] Monitor performance and resource usage
- [ ] Configure production CORS settings
- [ ] Set up monitoring/alerting
- [ ] Consider adding queue system for concurrent requests

## Support

- **Documentation**: `reporting-service/README.md`
- **Quick Start**: `reporting-service/QUICKSTART.md`
- **Code**: Well-commented TypeScript with JSDoc

---

**Migration Date**: February 2026  
**Status**: ✅ Complete and Ready for Testing
