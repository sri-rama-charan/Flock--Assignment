# Flock Energy API Wrapper

A clean, resilient REST API wrapper built on Node.js and Express that interfaces with the legacy Urja Meter Ops distribution metering portal (`https://urja-ops.flockenergy.tech`).

---

## Architecture & Layering

The codebase is organized into distinct, single-responsibility layers using CommonJS:

```text
flock-energy-api/
├── src/
│   ├── app.js                 # Express application configuration & top-level route mounting
│   ├── server.js              # Server entry point, configuration loader, and port listener
│   ├── config/
│   │   └── env.js             # Environment variable reading, validation, and sanitization
│   ├── clients/
│   │   └── portal.client.js   # HTTP client with persistent cookie jar, CSRF headers & single-retry reauthentication
│   ├── services/
│   │   └── meter.service.js   # Business logic, input validation, and SvelteKit devalue deserialization
│   ├── controllers/
│   │   └── meter.controller.js# Request parsing, HTTP status mapping (200, 400, 404, 502, 503, 504)
│   └── routes/
│       └── meter.routes.js    # Express Router definitions for /api/v1/meters
├── .env.example               # Template environment configuration
├── .gitignore                 # Version control exclusions
├── openapi.json               # OpenAPI 3.0.3 specification
├── package.json               # Dependencies and scripts
├── PROTOCOL.md                # Reverse engineering analysis of Urja Ops Portal
├── README.md                  # System documentation & usage guide
└── REFLECTION.md              # Engineering decisions, trade-offs, and future improvements
```

### Data Flow

```text
[ Client Request ]
       │
       ▼
[ Express app.js ] ──► [ meter.routes.js ]
                             │
                             ▼
                 [ meter.controller.js ]
                 (Extracts query/params, maps HTTP status codes & errors)
                             │
                             ▼
                   [ meter.service.js ]
                   (Input validation & SvelteKit devalue parsing)
                             │
                             ▼
                   [ portal.client.js ]
                   (Persistent cookie jar, CSRF headers, auto-reauth)
                             │
                             ▼
                 [ Urja Meter Ops Portal ]
```

---

## Prerequisites & Installation

- **Node.js**: `v18.0.0` or higher (verified on Node.js `v22.14.0`)
- **Package Manager**: `npm` `9.0.0` or higher

```bash
# Clone and enter repository
git clone https://github.com/sri-rama-charan/Flock--Assignment.git
cd Flock--Assignment

# Install dependencies
npm install
```

---

## Environment Configuration

Copy `.env.example` to create `.env`:

```bash
cp .env.example .env
```

Configure your environment variables in `.env`:

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | No | `3000` | Port for the local Express server |
| `PORTAL_BASE_URL` | Yes | `https://urja-ops.flockenergy.tech` | Base URL of the upstream Urja Ops portal |
| `PORTAL_USERNAME` | Yes | — | Operator username/email for the portal |
| `PORTAL_PASSWORD` | Yes | — | Operator password for the portal |

> **Security Note:** `.env` is ignored by `.gitignore`. Real credentials, session tokens, and passwords must never be committed to source control.

---

## Running the Application

### Production Mode
```bash
npm start
```

### Development Mode (Auto-reloading on changes)
```bash
npm run dev
```

The server binds to `http://localhost:3000` (or your configured `PORT`).

---

## API Endpoints

### 1. Health Check
Verifies that the API service is alive.

- **Method:** `GET`
- **Path:** `/health`
- **Response:** `200 OK`
  ```json
  {
    "status": "ok"
  }
  ```

---

### 2. List & Search Meters
Retrieves paginated meter records, with optional search filtering by serial number, meter ID, or make.

- **Method:** `GET`
- **Path:** `/api/v1/meters`
- **Query Parameters:**
  - `page` *(optional, integer >= 1, default: 1)*: Page number (1 to 1,000,000).
  - `search` or `q` *(optional, string)*: Filter query matching meter ID, serial number, or make (max 200 characters). If both `search` and `q` are provided, `search` takes precedence.
- **Success Response:** `200 OK`
  ```json
  {
    "data": [
      {
        "meterId": "J100000",
        "serialNo": "SE33962",
        "make": "HPL",
        "phaseType": "single",
        "installStatus": "Decommissioned",
        "dtCode": "DT-001"
      }
    ],
    "total": 403,
    "page": 1,
    "pageSize": 20
  }
  ```
- **Error Responses:**
  - `400 Bad Request` (Invalid page number):
    ```json
    {
      "error": {
        "code": "INVALID_PAGE",
        "message": "Invalid page: page must be a positive integer between 1 and 1,000,000."
      }
    }
    ```

---

### 3. Get Meter Details
Retrieves nameplate parameters and electrical hierarchy for a single meter.

- **Method:** `GET`
- **Path:** `/api/v1/meters/:meterId`
- **Path Parameters:**
  - `meterId` *(required, string)*: Unique meter identifier (e.g. `J100000`, max 100 characters).
- **Success Response:** `200 OK`
  ```json
  {
    "meterId": "J100000",
    "detail": {
      "data": [
        { "parameterName": "Meter ID", "parameterValue": "J100000" },
        { "parameterName": "Serial No", "parameterValue": "SE33962" },
        { "parameterName": "Make", "parameterValue": "HPL" },
        { "parameterName": "Phase Type", "parameterValue": "single" },
        { "parameterName": "Installation Status", "parameterValue": "Decommissioned" },
        { "parameterName": "Installation Type", "parameterValue": "Whole Current" }
      ]
    },
    "hierarchy": {
      "Meter ID": "J100000",
      "Installation Status": "Decommissioned",
      "Installation Type": "Whole Current",
      "Zone": "Jaipur Zone 1 (Z-01)",
      "Circle": "Circle 1 (C-01)",
      "Division": "Division 1 (D-01)",
      "Subdivision": "Subdivision 1 (SD-01)",
      "Sub Station": "Substation 1 (SS-01)",
      "Feeder": "Feeder 1 (F-001)",
      "DT": "Malviya Nagar DT 1 (DT-001)"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request` (Empty or whitespace ID):
    ```json
    {
      "error": {
        "code": "INVALID_METER_ID",
        "message": "Invalid meterId: meterId must be a non-empty string."
      }
    }
    ```
  - `404 Not Found` (Meter not found):
    ```json
    {
      "error": {
        "code": "METER_NOT_FOUND",
        "message": "Meter 'NON_EXISTENT_MTR' not found on Urja Ops portal."
      }
    }
    ```

---

### 4. Get Meter Location
Retrieves geographic coordinates (latitude and longitude) for a specific meter.

- **Method:** `GET`
- **Path:** `/api/v1/meters/:meterId/location`
- **Path Parameters:**
  - `meterId` *(required, string)*: Unique meter identifier (e.g. `J100000`).
- **Success Response:** `200 OK`
  ```json
  {
    "latitude": "26.938961002479868",
    "longitude": "75.83095696146852",
    "data": {
      "latitude": "26.938961002479868",
      "longitude": "75.83095696146852"
    }
  }
  ```
- **Error Responses:**
  - `400 Bad Request`:
    ```json
    {
      "error": {
        "code": "INVALID_METER_ID",
        "message": "Invalid meterId: meterId must be a non-empty string."
      }
    }
    ```
  - `404 Not Found`:
    ```json
    {
      "error": {
        "code": "LOCATION_NOT_FOUND",
        "message": "Location not found for meter 'NON_EXISTENT_MTR'."
      }
    }
    ```

---

## Error Handling & Status Codes

All API errors return a standardized JSON structure with machine-readable error codes and human-friendly messages:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description"
  }
}
```

| Status Code | Error Code | Description | Typical Cause |
| :---: | :--- | :--- | :--- |
| **`400`** | `INVALID_PAGE` | Invalid pagination parameter | Non-integer, negative, zero, empty, or `> 1,000,000` page number. |
| **`400`** | `INVALID_QUERY` | Invalid search query | Non-string search query or query exceeding 200 characters. |
| **`400`** | `INVALID_METER_ID` | Malformed meter ID | Missing, empty, whitespace-only, illegal chars, or `> 100` characters. |
| **`404`** | `METER_NOT_FOUND` | Meter not found | Meter identifier does not exist in the upstream portal. |
| **`404`** | `LOCATION_NOT_FOUND` | Location not found | Location coordinates not found for the requested meter. |
| **`404`** | `ROUTE_NOT_FOUND` | Unknown API endpoint | Request made to an unregistered URL path or method. |
| **`502`** | `UPSTREAM_AUTH_FAILED` | Upstream authentication failed | Upstream portal rejected credentials or session token missing. |
| **`502`** | `UPSTREAM_INVALID_RESPONSE` | Malformed upstream payload | Portal returned non-JSON, unexpected structure, or incomplete data. |
| **`502`** | `INVALID_LOCATION_COORDINATES`| Invalid coordinates | Upstream coordinates are non-numeric or outside [-90..90, -180..180]. |
| **`502`** | `UPSTREAM_SERVER_ERROR` | Upstream internal error | Urja Ops portal returned HTTP 5xx server error. |
| **`503`** | `UPSTREAM_UNAVAILABLE` | Service unavailable | Network connection refused or portal domain unreachable. |
| **`503`** | `UPSTREAM_RATE_LIMITED` | Upstream rate limited | Upstream portal rate limit exceeded (HTTP 429). |
| **`504`** | `UPSTREAM_TIMEOUT` | Gateway timeout | Upstream request exceeded the 10,000ms timeout window. |
| **`500`** | `INTERNAL_SERVER_ERROR` | Internal server error | Unhandled application error (sanitized, stack traces suppressed). |

---

## Assumptions, Trade-offs & Limitations

1. **Authentication State in Memory**:
   - The Portal Client maintains the cookie jar in memory. If the Node process restarts, it logs in again on the first request.
   - *Trade-off*: Simple and stateless across server restarts; acceptable for this API wrapper without adding Redis or database dependencies.
2. **SvelteKit CSRF Protection**:
   - SvelteKit form action endpoints reject cross-origin form POSTs. The client explicitly sends matching `Origin` and `Referer` headers to satisfy `check_origin`.
3. **Session Cookie Prefix**:
   - Better-auth over HTTPS sets `__Secure-better-auth.session_token`. The client detects session cookies by matching `session_token` in cookie keys.
4. **Skipped Work**:
   - Transformer endpoints, meter consumption history (`/energy`), and write operations were not in the scope of this assignment and remain unimplemented.

---

## Manual Verification Guide (PowerShell)

Ensure your server is running (`npm start`) on port 3000, then execute these commands in PowerShell:

```powershell
# 1. Health check
Invoke-RestMethod -Uri "http://localhost:3000/health" -Method Get | ConvertTo-Json

# 2. List meters on page 1
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/meters?page=1" -Method Get | Select-Object total, page, pageSize, @{Name='count'; Expression={$_.data.Length}}

# 3. Search meter by serial
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/meters?search=SE33962&page=1" -Method Get | Select-Object total, @{Name='meterId'; Expression={$_.data[0].meterId}}

# 4. Get meter details
$details = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/meters/J100000" -Method Get
[PSCustomObject]@{ MeterId = $details.meterId; NameplateRows = $details.detail.data.Length; DT = $details.hierarchy.DT }

# 5. Get meter location
$loc = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/meters/J100000/location" -Method Get
[PSCustomObject]@{ Latitude = $loc.latitude; Longitude = $loc.longitude }

# 6. Verify non-existent meter returns 404
try {
  Invoke-RestMethod -Uri "http://localhost:3000/api/v1/meters/NON_EXISTENT_MTR" -Method Get
} catch {
  [PSCustomObject]@{ StatusCode = [int]$_.Exception.Response.StatusCode }
}

# 7. Verify invalid page returns 400
try {
  Invoke-RestMethod -Uri "http://localhost:3000/api/v1/meters?page=0" -Method Get
} catch {
  [PSCustomObject]@{ StatusCode = [int]$_.Exception.Response.StatusCode }
}
```
