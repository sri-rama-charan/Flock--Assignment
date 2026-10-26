# Urja Meter Ops Portal: Reverse-Engineered Protocol Documentation

This document describes the HTTP protocol, authentication mechanisms, and data serialization formats of the upstream **Urja Meter Ops Portal** (`https://urja-ops.flockenergy.tech`), determined via network inspection and live runtime analysis.

---

## 1. Observed Architecture & Framework

The Urja Ops portal is built using **SvelteKit** and uses **better-auth** for session management.
Because it is a modern full-stack SvelteKit application rather than a conventional headless REST API, its endpoints fall into two distinct categories:

1. **Direct JSON Endpoints (`/portal/...`)**: Traditional REST-like endpoints called asynchronously by client components.
2. **SvelteKit Data Endpoints (`/__data.json`)**: Server-rendered data loaders serialized using SvelteKit's `devalue` format.

---

## 2. Authentication & Session Management

### Login Request
- **Endpoint:** `POST /login`
- **Content-Type:** `application/x-www-form-urlencoded`
- **Form Fields:**
  - `email`: Operator email address (e.g. `operator@example.com`)
  - `password`: Operator password
- **Required Security Headers (Observed Fact):**
  - `Origin: https://urja-ops.flockenergy.tech`
  - `Referer: https://urja-ops.flockenergy.tech/login`
  > **Note on CSRF Enforcement:** SvelteKit form actions enforce origin checks via `check_origin`. In Node.js environments where `Origin` is omitted by default, the portal rejects the request with `HTTP 403: Cross-site POST form submissions are forbidden`. Setting the matching `Origin` header is required.

### Login Response
- **Status:** `HTTP 200 OK` (when enhanced form action headers or JSON accept headers are sent)
- **Response Body:**
  ```json
  {
    "type": "redirect",
    "status": 303,
    "location": "/meters"
  }
  ```
- **Session Cookie:**
  - **Key:** `__Secure-better-auth.session_token` *(on HTTPS origins)*
  - **Observed Attributes:** `Max-Age=3600; Path=/; HttpOnly; Secure; SameSite=Lax`
  - **Observed Expiration:** 3600 seconds (1 hour).

### Session Verification Strategy
- A successful login cannot be confirmed by `HTTP 200` alone, because SvelteKit also returns `HTTP 200` for form action validation failures (with `{ type: "failure" }`).
- A session is confirmed valid only when `__Secure-better-auth.session_token` is present in the cookie jar.

---

## 3. Upstream Endpoints Catalog

### Endpoint 1: Meter Search & Listing
- **Endpoint:** `GET /portal/meters/search?q={searchQuery}&page={page}`
- **Authentication:** Requires `__Secure-better-auth.session_token` cookie.
- **Query Parameters:**
  - `q` *(string)*: Search string matching meter serial number, meter ID, or make.
  - `page` *(integer >= 1)*: 1-indexed pagination page.
- **Observed Response Shape (`HTTP 200`):**
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
- **Quirks & Behaviors:**
  - Passing `q=` (empty string) returns the full dataset paginated by `pageSize: 20`.
  - Searches for `meterId` (e.g. `J100000`) or `serialNo` (e.g. `SE33962`) filter down to exact matches.

---

### Endpoint 2: Meter Nameplate & Hierarchy Details
- **Endpoint:** `GET /meters/{meterId}/__data.json`
- **Authentication:** Requires `__Secure-better-auth.session_token` cookie.
- **Observed Response Shape (`HTTP 200`):**
  SvelteKit devalue serialized object graph:
  ```json
  {
    "type": "data",
    "nodes": [
      null,
      {
        "type": "data",
        "data": [
          { "user": 1 },
          { "name": 2, "email": 3 },
          "Ops Desk",
          "operator@example.com"
        ],
        "uses": {}
      },
      {
        "type": "data",
        "data": [
          {
            "meterId": 1,
            "detail": 2,
            "hierarchy": 21
          },
          "J100000",
          { "data": 3 },
          [4, 6, 9, 12, 15, 18],
          { "parameterName": 5, "parameterValue": 1 },
          "Meter ID",
          { "parameterName": 7, "parameterValue": 8 },
          "Serial No",
          "SE33962",
          "..."
        ],
        "uses": { "params": ["id"] }
      }
    ]
  }
  ```
- **Error Behavior for Missing Meter:**
  When a meter does not exist (e.g. `NON_EXISTENT_MTR`), the portal returns `HTTP 200` with an error node:
  ```json
  {
    "type": "data",
    "nodes": [
      null,
      { "type": "data", ... },
      {
        "type": "error",
        "error": { "message": "Meter not found" },
        "status": 404
      }
    ]
  }
  ```
- **Parsing Algorithm:**
  1. Inspect `nodes` array. If any node has `node.type === "error"`, extract `node.status` and `node.error.message`.
  2. Locate the node containing an array in `node.data`.
  3. Recursively unflatten index pointers (where numbers in object properties index referenced values in `node.data`).
  4. Extract `meterId`, `detail`, and `hierarchy`.

---

### Endpoint 3: Meter Geographic Location
- **Endpoint:** `GET /portal/meters/{meterId}/geo`
- **Authentication:** Requires `__Secure-better-auth.session_token` cookie.
- **Observed Response Shape (`HTTP 200`):**
  ```json
  {
    "data": {
      "latitude": "26.938961002479868",
      "longitude": "75.83095696146852"
    }
  }
  ```
- **Observed Error Response (`HTTP 404`):**
  When a meter ID does not exist, the endpoint returns an actual `HTTP 404` response.

---

### Endpoint 4: Meter Energy / Consumption Readings (Observed)
- **Endpoint:** `GET /portal/meters/{meterId}/energy`
- **Authentication:** Requires `__Secure-better-auth.session_token` cookie.
- **Observed Response Shape (`HTTP 200`):**
  ```json
  {
    "data": [
      {
        "timestamp": "24/06/2026 14:00",
        "kwh": "48450.99",
        "kvah": "52327.08",
        "voltR": "230"
      }
    ]
  }
  ```

---

## 4. Summary of Facts vs. Assumptions

| Item | Status | Evidence |
| :--- | :---: | :--- |
| **Login Content-Type** | **Observed Fact** | HTML `<form method="POST">` rendered with `email` and `password` inputs. Form submissions succeeded with `application/x-www-form-urlencoded`. |
| **CSRF Requirement** | **Observed Fact** | Requests without `Origin` failed with `HTTP 403 Cross-site POST form submissions are forbidden`. |
| **Cookie Name** | **Observed Fact** | Set-Cookie header explicitly names `__Secure-better-auth.session_token`. |
| **Cookie Max-Age** | **Observed Fact** | `Max-Age=3600` observed in upstream `Set-Cookie` header. |
| **Details Serialization** | **Observed Fact** | `GET /meters/{id}/__data.json` returns flattened token indices created by SvelteKit's `devalue` serializer. |
| **Session Lifetime** | **Assumption** | Assumed 1 hour based on `Max-Age=3600`. The client handles premature expiration gracefully by catching `HTTP 401/403` and re-authenticating. |
