# Quick Start Guide - Reporting Service

## For Developers

### 1. Install Dependencies

```bash
# From the reporting-service directory
cd reporting-service
pnpm install
pnpm exec playwright install chromium
```

### 2. Start the Service

```bash
# Development mode (auto-restart)
pnpm dev
```

The service will start on `http://localhost:3001`

### 3. Test It

**Option A: Use curl**

```bash
curl http://localhost:3001/health
```

**Option B: Generate a report from the Angular app**

1. Start the main Angular app: `pnpm start` (from root directory)
2. Navigate to Reports
3. Click "Generate Report"

## For DevOps

### Docker Deployment

```bash
# Build and run
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f reporting-service
```

### Environment Configuration

Set `window.REPORTING_SERVICE_URL` in your deployment:

```html
<!-- index.html -->
<script>
  window.REPORTING_SERVICE_URL = 'https://reporting.your-domain.com';
</script>
```

### Health Monitoring

```bash
# Check health
curl https://reporting.your-domain.com/health

# Expected response
{
  "status": "ok",
  "service": "eta-reporting-service",
  "browser": "ready"
}
```

## Troubleshooting

| Issue                     | Solution                                                 |
| ------------------------- | -------------------------------------------------------- |
| `Browser not initialized` | Run `pnpm exec playwright install chromium`              |
| Timeout errors            | Increase `timeout` in request or check dashboard loading |
| Auth errors               | Verify JWT token is valid and has dashboard permissions  |
| Docker crashes            | Increase `shm_size` in docker-compose.yml                |

## Architecture Flow

```
1. User clicks "Generate Report" in Angular
   ↓
2. Frontend calls ReportService.generateReport()
   ↓
3. ReportService fetches report config (dashboard IDs)
   ↓
4. Constructs URL: /dashboards/{id}?data-capture=true
   ↓
5. Calls reporting-service POST /generate
   ↓
6. Playwright opens dashboard in headless browser
   ↓
7. Waits for .eta-public-data-captured class
   ↓
8. Captures PDF
   ↓
9. Returns PDF to frontend
   ↓
10. User downloads report
```

## Next Steps

- [ ] Deploy to production environment
- [ ] Configure monitoring/alerts
- [ ] Set up backup/failover
- [ ] Test with real dashboards
- [ ] Optimize timeout settings
