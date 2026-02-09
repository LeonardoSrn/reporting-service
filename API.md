# API Documentation

## Base URL

**Local**: `http://localhost:3001`  
**Production**: Configure via `window.REPORTING_SERVICE_URL`

## Authentication

The service forwards the `Authorization` header to the target URL (dashboard).
Include your JWT token in requests:

```http
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Health Check

Check if the service is running and ready.

**Endpoint**: `GET /health`

**Request**:

```bash
curl http://localhost:3001/health
```

**Response**:

```json
{
  "status": "ok",
  "service": "eta-reporting-service",
  "version": "1.0.0",
  "browser": "ready",
  "timestamp": "2024-02-09T12:00:00.000Z"
}
```

**Status Codes**:

- `200 OK` - Service is healthy

---

### 2. Generate PDF/Screenshot

Generate a PDF or PNG screenshot from a URL.

**Endpoint**: `POST /generate`

**Request Headers**:

```http
Content-Type: application/json
Authorization: Bearer <token>
```

**Request Body**:

```json
{
  "url": "https://<api_url>/dashboards/123?data-capture=true",
  "format": "pdf",
  "timeout": 60000,
  "width": 1920,
  "height": 1080,
  "waitForClass": "eta-public-data-captured"
}
```

**Parameters**:

| Field          | Type   | Required | Default                      | Description                                  |
| -------------- | ------ | -------- | ---------------------------- | -------------------------------------------- |
| `url`          | string | ✅ Yes   | -                            | Full URL to capture (must be valid URL)      |
| `format`       | enum   | ✅ Yes   | -                            | `"pdf"` or `"png"`                           |
| `timeout`      | number | ❌ No    | `60000`                      | Max wait time in ms (for navigation + class) |
| `width`        | number | ❌ No    | `1920`                       | Viewport width in pixels                     |
| `height`       | number | ❌ No    | `1080`                       | Viewport height in pixels                    |
| `waitForClass` | string | ❌ No    | `"eta-public-data-captured"` | CSS class to wait for                        |

**Response** (Success):

- **Content-Type**: `application/pdf` or `image/png`
- **Content-Disposition**: `attachment; filename="report-1707480000000.pdf"`
- **Body**: Binary file data

**Response** (Error):

```json
{
  "error": "Report generation failed",
  "message": "Navigation timeout of 60000ms exceeded",
  "timestamp": "2024-02-09T12:00:00.000Z"
}
```

**Status Codes**:

- `200 OK` - PDF/PNG generated successfully
- `400 Bad Request` - Invalid request parameters
- `500 Internal Server Error` - Generation failed

**Example Request** (cURL):

```bash
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGc..." \
  -d '{
    "url": "http://localhost:4200/dashboards/123?data-capture=true",
    "format": "pdf",
    "timeout": 60000
  }' \
  --output report.pdf
```

**Example Request** (JavaScript):

```javascript
const response = await fetch("http://localhost:3001/generate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  },
  body: JSON.stringify({
    url: "http://localhost:4200/dashboards/123?data-capture=true",
    format: "pdf",
    timeout: 60000,
  }),
});

if (response.ok) {
  const blob = await response.blob();
  // Download or display the PDF
} else {
  const error = await response.json();
  console.error("Generation failed:", error);
}
```

**Example Request** (Angular):

```typescript
this.http
  .post<Blob>(
    "http://localhost:3001/generate",
    {
      url: dashboardUrl,
      format: "pdf",
      timeout: 60000,
    },
    {
      headers: {
        Authorization: `Bearer ${this.authService.token()}`,
      },
      responseType: "blob" as "json",
    },
  )
  .subscribe({
    next: (blob) => {
      // Download the PDF
      this.downloadBlob(blob, "report.pdf");
    },
    error: (err) => {
      console.error("Failed to generate report:", err);
    },
  });
```

## Error Handling

### Validation Errors (400)

Request body validation errors return detailed information:

```json
{
  "error": "Invalid request",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["url"],
      "message": "Required"
    }
  ]
}
```

### Server Errors (500)

Internal errors return a message:

```json
{
  "error": "Report generation failed",
  "message": "Browser not initialized. Call initialize() first.",
  "timestamp": "2024-02-09T12:00:00.000Z"
}
```

Common error messages:

- `"Browser not initialized"` - Service starting up, retry in a few seconds
- `"Navigation timeout exceeded"` - Dashboard didn't load in time, increase
  timeout
- `"Waiting for selector ".eta-public-data-captured" failed"` - Data capture
  didn't complete

## Rate Limiting

Currently not implemented. For production, consider adding:

- Request queue
- Concurrent request limits
- Per-user rate limiting

## CORS

Development mode allows all origins (`Access-Control-Allow-Origin: *`).

For production, update `src/server.ts` to restrict origins:

```typescript
res.header("Access-Control-Allow-Origin", "https://<api_url>");
```

## Monitoring

### Metrics to Track

- Request count
- Success/failure rate
- Average generation time
- Browser memory usage
- Queue length (if implemented)

### Logging

All requests are logged:

```
[2024-02-09T12:00:00.000Z] POST /generate
[Generate] Starting capture for: https://...
[Generate] Format: pdf
[ScreenshotService] Navigating to: https://...
[ScreenshotService] Waiting for class: eta-public-data-captured
[ScreenshotService] Capturing PDF...
[ScreenshotService] Capture complete: report-1707480000000.pdf
[Generate] Success: report-1707480000000.pdf
```

## Performance

### Typical Generation Times

- Simple dashboard: 5-15 seconds
- Complex dashboard: 15-30 seconds
- Very complex (many widgets): 30-60 seconds

### Optimization Tips

1. **Reduce timeout for fast dashboards** - Save resources
2. **Use PNG for previews** - Faster than PDF
3. **Implement caching** - Cache PDFs for repeated requests
4. **Scale horizontally** - Run multiple instances
5. **Use queue system** - Handle concurrent requests gracefully

## Troubleshooting

See the main [README.md](./README.md#-troubleshooting) for detailed
troubleshooting.

Quick checklist:

- ✅ Service health check returns 200
- ✅ Dashboard URL is accessible
- ✅ Auth token is valid and has permissions
- ✅ Dashboard renders completely
- ✅ `.eta-public-data-captured` class appears
- ✅ Timeout is sufficient for dashboard loading
