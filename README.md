# Nhalo

Nhalo is a family-first home decision engine that ranks homes by price, size, and safety.

## MVP Contents

- Fastify API with deterministic search and scoring
- Internal React test UI for submitting searches and inspecting score breakdowns
- Mock provider adapters behind stable interfaces
- PostgreSQL-ready persistence via Prisma
- Immutable score audits, market baseline snapshots, provider health tracking, and metrics
- Hybrid live/mock safety provider architecture with live-capable crime and school adapters
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

## Operational Endpoints

- `GET /health`
- `GET /providers/status`
- `GET /scores/audit/:propertyId`
- `GET /metrics`

## Reliability Features

- Provider runtime tracks latency, failure count, last successful update time, and computed data age.
- Provider failures fall back to cached data where available and otherwise degrade confidence instead of crashing search.
- Each scored result is persisted with raw numeric inputs, confidence metadata, and immutable formula version.
- Market price-per-square-foot baselines are snapshotted per search area and reused for up to 24 hours.
- Safety resolution now supports `live`, `cached_live`, `stale_cached_live`, `mock`, and `none` provenance modes.
- Live safety configuration is controlled with `SAFETY_PROVIDER_MODE`, crime/school provider base URLs and API keys, and cache TTL env vars.
