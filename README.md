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

1. Copy `.env.example` to `.env`.
2. Start the full stack with `docker compose up --build`.
3. Open the UI at `http://localhost:5173`.
4. Reach the API at `http://localhost:3000`.

The Docker stack now runs PostgreSQL, the Fastify API, and the Vite web app together. On startup, the API container runs `prisma db push` and `prisma generate` before entering watch mode, so you do not need to run `yarn dev:api` or `yarn dev:web` on the host.

To stop the stack, run `docker compose down`. Add `-v` if you also want to remove the local Postgres volume.

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
