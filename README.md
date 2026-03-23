# Nhalo

Nhalo is a family-first home decision engine that ranks homes by price, size, and safety.

## MVP Contents

- Fastify API with deterministic search and scoring
- Internal React test UI for submitting searches and inspecting score breakdowns
- Mock provider adapters behind stable interfaces
- PostgreSQL-ready persistence via Prisma
- Unit and integration tests for scoring and `/search`

## Run Locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env`.
3. Start PostgreSQL with `docker compose up -d`.
4. Generate Prisma client with `npm run db:generate`.
5. Start the API with `npm run dev:api`.
6. Start the UI with `npm run dev:web`.

## Example Search Request

```json
{
  "locationType": "city",
  "locationValue": "Southfield, MI",
  "radiusMiles": 5,
  "budget": {
    "max": 425000
  },
  "minSqft": 1800,
  "minBedrooms": 3,
  "weights": {
    "price": 40,
    "size": 30,
    "safety": 30
  }
}
```
