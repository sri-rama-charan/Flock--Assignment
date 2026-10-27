# Engineering Reflection: Flock Energy API

This document details the architectural decisions, trade-offs, error-handling mechanisms, and future improvements considered during the development of the Flock Energy API wrapper around the Urja Meter Ops portal.

---

## 1. Design Decisions & Architecture

### A. Strict Layered Separation
The codebase separates concerns into four distinct layers:
1. **Routes (`src/routes/`)**: Focuses solely on URI routing and parameter extraction order. Registering `/:meterId/location` before `/:meterId` avoids route collision in Express.
2. **Controllers (`src/controllers/`)**: Acts as the HTTP adapter. It reads requests, delegates business operations to services, and maps service exceptions into standard HTTP status codes (`200`, `400`, `404`, `502`, `504`).
3. **Services (`src/services/`)**: Enforces input validation (e.g., verifying `page >= 1` and non-empty `meterId`), handles protocol deserialization (such as unflattening SvelteKit's serialized `__data.json` format), and normalizes domain objects.
4. **Clients (`src/clients/`)**: Encapsulates external HTTP communication, maintaining session cookies, setting required CSRF headers, and managing transparent re-authentication.

### B. Minimalist Tech Stack (Zero Build Step)
- Selected plain CommonJS (`require` / `module.exports`) and native Node.js APIs (such as `URLSearchParams`) without transpilation layers (no TypeScript, Babel, or bundling).
- This ensures any developer can clone the repository, run `npm install`, and immediately execute or debug the application using standard Node.js without build steps.

### C. Safe Parameter Serialization
- Rather than manually concatenating query parameters into URLs (which risks injection and encoding bugs), queries are passed directly to Axios's `params` configuration (`portalClient.get('/portal/meters/search', { params: { q, page } })`).

---

## 2. Handling Authentication & Upstream Failures

### A. Reverse-Engineering SvelteKit's CSRF Enforcement
- SvelteKit form action endpoints enforce origin checking on state-changing requests (`POST /login`). In browser contexts, browsers automatically transmit `Origin` and `Referer` headers. However, Node.js HTTP clients omit them by default, triggering an `HTTP 403 Cross-site POST form submissions are forbidden`.
- By configuring the client to explicitly supply `Origin: env.portalBaseUrl` and `Referer: env.portalBaseUrl + '/login'`, the client cleanly conforms with upstream CSRF requirements.

### B. Transparent Re-authentication with Loop Prevention
- When an upstream endpoint returns `HTTP 401 Unauthorized` or `HTTP 403 Forbidden`, the client catches the error, checks `options._isRetry`, clears the cookie jar, logs in again, and retries the original request once.
- The `_isRetry` flag ensures that a failing second attempt immediately throws rather than looping indefinitely.

### C. Deserializing SvelteKit Devalue Data
- Meter nameplate parameters and electrical hierarchy are rendered via SvelteKit's server data loader at `GET /meters/{id}/__data.json`.
- This endpoint uses SvelteKit's `devalue` format (storing object graphs as indexed token arrays). A lightweight recursive deserializer (`unflattenSvelteKitData`) resolves these token indices cleanly, preserving the upstream nameplate array and hierarchy structure without scraping HTML.

### D. Zero Credential & Secret Leakage
- Upstream network errors, stack traces, raw cookies, and authentication passwords are never printed to logs or returned in HTTP error payloads. All API errors are normalized to `{ "error": { "code": "<CODE>", "message": "<sanitized_message>" } }`.

---

## 3. Limitations & Trade-offs

1. **In-Memory Session Storage**:
   - Session cookies are held in-memory via `tough-cookie`. If the Node process restarts, the session is cleared, requiring a re-login on the next incoming request.
   - *Trade-off*: Avoids introducing Redis or database dependencies for a lightweight API wrapper, but would not support horizontal clustering across multiple Node.js instances without a shared cookie store.
2. **Coupling to SvelteKit Internal Route Data**:
   - Because the portal does not expose a standalone REST endpoint for meter nameplate parameters, the API relies on `/meters/{id}/__data.json`. If the portal's internal frontend routing changes, this endpoint could shift.
   - *Mitigation*: The service scans `nodes` dynamically rather than hardcoding array index `2`.
3. **No Downstream Client Rate Limiting**:
   - The current API wrapper lacks a token bucket or rate limiter. Rapid client requests directly proxy to the upstream Urja portal.

---

## 4. What I Would Improve with More Time

1. **Shared Distributed Session Cache**:
   - Replace in-memory cookie storage with a Redis-backed session store to enable multi-instance horizontal scaling without repeated logins.
2. **Automated Integration & Contract Test Suite**:
   - Implement integration tests using `node:test` and mock servers (`nock` / `msw`) with captured fixture responses to verify edge cases (upstream 500s, malformed devalue tokens, expired cookies) automatically in CI/CD.
3. **OpenAPI Interactive Documentation**:
   - Integrate `swagger-ui-express` to serve the generated `openapi.json` interactively at `/api-docs`.
4. **Structured Logging & Metrics**:
   - Add structured JSON logging (e.g. `pino`) with correlation IDs (`x-request-id`) to trace requests between downstream callers, the API wrapper, and upstream portal calls.
5. **Consumption & Transformer Endpoints**:
   - Implement `GET /api/v1/meters/:meterId/energy` (using the observed `/portal/meters/{id}/energy` endpoint) and transformer endpoints (`/transformers`).
