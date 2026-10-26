# Flock Energy API

A clean REST API wrapper around the Urja Meter Ops portal, built for the Flock Energy engineering take-home assignment.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express.js 5.x
- **Module System:** CommonJS (`require` / `module.exports`)
- **HTTP Client:** Axios
- **Configuration:** dotenv
- **Package Manager:** npm
- **Testing:** Node.js built-in test runner (`node:test` and `node:assert`)

## Project Structure

```text
flock-energy-api/
├── src/
│   ├── app.js            # Express application setup and route mounting
│   ├── server.js         # Server bootstrap and port listening
│   ├── config/
│   │   └── env.js        # Environment configuration reading and validation
│   ├── clients/          # External HTTP/portal API clients (e.g. Urja portal client)
│   ├── services/         # Business logic and coordination layer
│   ├── controllers/      # Request handlers and response formatters
│   ├── routes/           # Express router definitions
│   └── middleware/       # Custom Express middleware (auth, error handlers)
├── tests/                # Automated test suites
├── .env.example          # Template for environment variables
├── .gitignore            # Git ignore rules for node_modules and secrets
├── package.json          # Project metadata, dependencies, and scripts
└── README.md             # Project documentation
```

## Getting Started

### 1. Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### 2. Installation

Install project dependencies:

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment configuration file to `.env`:

```bash
cp .env.example .env
```

Configure the environment variables in `.env`:

| Variable | Description | Default | Required |
| --- | --- | --- | --- |
| `PORT` | Port number on which the API server listens | `3000` | No |
| `PORTAL_BASE_URL` | Base URL of the Urja Meter Ops portal | None | Yes |

### 4. Running the Server

Start the production server:

```bash
npm start
```

Start the development server with automatic reloading (Node.js `--watch` mode):

```bash
npm run dev
```

### 5. Running Tests

Run the test suite using Node's built-in test runner:

```bash
npm test
```

## API Endpoints

### Health Check

- **Endpoint:** `GET /health`
- **Description:** Verifies service availability.
- **Success Response:** `200 OK`
  ```json
  {
    "status": "ok"
  }
  ```
