# Reporting & Public Dashboard Flows

## Two Separate Features

### 1️⃣ Manual Report Generation (Working Now!)

**User Action**: Click "Generate Report" button

```
┌─────────────────────────────────────────────┐
│  User clicks "Generate Report"              │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  Frontend: ReportService.generateReport()   │
│  - Fetches report config                    │
│  - Gets dashboard ID                        │
│  - Constructs URL with ?data-capture=true   │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  POST http://localhost:3001/generate        │
│  {                                          │
│    url: "/dashboards/123?data-capture=true",│
│    format: "pdf"                            │
│  }                                          │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  Reporting Service (Playwright)             │
│  - Opens dashboard in headless browser      │
│  - Waits for .eta-public-data-captured      │
│  - Captures PDF                             │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  PDF downloaded by user                     │
└─────────────────────────────────────────────┘
```

**This works completely in the frontend + reporting service!**

---

### 2️⃣ Public Dashboard Links (Backend Job Required)

**User Action**: Click "Create Public Link" in dashboard share dialog

```
┌─────────────────────────────────────────────┐
│  User creates public share link             │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  Frontend: DashboardShareService.createShare│
│  POST /api/dashboards/{id}/shares           │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  Backend: Creates share token               │
│  - Generates unique share URL               │
│  - Returns: {                               │
│      id: "share-123",                       │
│      shareUrl: "/public/dashboards/...?share=true",│
│      publicData: null  ← NOT CAPTURED YET   │
│    }                                        │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  ⚠️  MISSING: Backend Scheduler Job         │
│                                             │
│  Backend SHOULD:                            │
│  1. Detect new share created                │
│  2. Call reporting service to capture data  │
│  3. Store captured data in publicData field │
│                                             │
│  OR                                         │
│                                             │
│  Backend SHOULD:                            │
│  1. Open dashboard with ?data-capture=true  │
│  2. Wait for completion                     │
│  3. Call updatePublicDashboardData()        │
└─────────────────────────────────────────────┘
```

**This requires backend implementation!**

The frontend only creates the share - the backend needs to:

- Schedule a job to capture the dashboard
- OR trigger capture immediately
- Store the captured data in the `publicData` field

---

## What Works Now

✅ **Manual Report Generation**

- User clicks "Generate Report"
- Frontend directly calls reporting service
- PDF downloads immediately

## What Needs Backend Work

❌ **Automatic Public Dashboard Data Capture**

- User creates public share link
- Backend needs to:
  - Detect new share creation
  - Open dashboard with headless browser (or use reporting service)
  - Capture all HTTP responses
  - Store in `publicData` field
  - Schedule periodic updates (daily/weekly)

---

## Current Public Dashboard Flow (View Only)

When someone visits a public dashboard link:

```
┌─────────────────────────────────────────────┐
│  User opens public share URL                │
│  /public/dashboards/{id}?share=true         │
└──────────────┬──────────────────────────────┘
               ▼
┌─────────────────────────────────────────────┐
│  Frontend: Loads dashboard                  │
│  - Fetches publicData from backend          │
│  - PublicDataInterceptor serves cached data │
│  - No live API calls                        │
└─────────────────────────────────────────────┘
```

This works IF `publicData` is already populated by backend!

---

## Solution Options

### Option A: Backend Scheduler (Recommended)

Backend creates a scheduled job when share is created:

```java
@PostMapping("/dashboards/{id}/shares")
public DashboardShare createShare(@PathVariable UUID id, @RequestBody CreateShareRequest request) {
    DashboardShare share = dashboardShareService.createShare(id, request);

    // Schedule data capture job
    dataCaptureScheduler.scheduleImmediate(share.getId());

    return share;
}
```

### Option B: Frontend Triggers (Manual)

Add a "Refresh Data" button in share dialog:

```typescript
refreshShareData(share: DashboardShare): void {
  // Call reporting service or backend endpoint
  this.reportService.captureShareData(share.dashboardId, share.id)
    .subscribe(() => {
      this.snackBar.open('Data capture started');
    });
}
```

### Option C: Webhook (Advanced)

Reporting service calls a webhook when capture completes:

```typescript
// After capturing
await this.http.post(`${backendUrl}/api/dashboards/${id}/shares/${shareId}/data`, {
  publicData: capturedData
});
```

---

## Testing Current Setup

### Test Manual Report Generation

1. Navigate to Reports
2. Click "Generate Report"
3. Watch console logs in reporting service
4. PDF should download

### Test Public Share (Partial)

1. Create public share link
2. Share is created but `publicData` is empty
3. Visiting the public URL won't work (no data)
4. **Backend needs to populate `publicData`**

---

## Next Steps

1. ✅ **Fix CORS** - Done! Restart reporting service
2. ✅ **Add logging** - Done! You'll see detailed logs
3. ❌ **Backend implementation** - Needs backend team to:
   - Add scheduler job
   - Call reporting service or implement capture
   - Store `publicData`

---

## Quick Test Commands

```bash
# Test health
curl http://localhost:3001/health

# Test manual capture (with auth)
curl -X POST http://localhost:3001/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "url": "http://localhost:4200/dashboards/YOUR_ID?data-capture=true",
    "format": "pdf"
  }' \
  --output test.pdf

# Check logs in reporting service terminal
```

---

**Summary**:

- ✅ Report generation: Works end-to-end (frontend → reporting service)
- ❌ Public share auto-capture: Needs backend scheduler job
