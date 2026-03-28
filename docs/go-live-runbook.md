# Nhalo Go-Live Runbook

## Local start

1. Start Postgres if you are using database-backed mode.
2. Copy `.env.example` to `.env` and pick an `APP_ENV_PROFILE`.
3. Run `yarn db:generate`.
4. If Postgres is reachable, run `yarn db:push`.
5. Start the API with `yarn dev:api`.
6. Start the web app with `yarn dev:web`.

## Readiness checks

- Run `yarn ops:check` for the internal go-live summary.
- Run `yarn ops:summary` for build, feature, and support context.
- Run `yarn ops:seed:verify` before a demo if demo scenarios should be available.
- Open `/ready` for dependency readiness and `/ops/summary` for the broader internal state.

## Recommended profiles

- `local_demo`: demo scenarios on, public sharing on, local-friendly defaults.
- `local_dev`: dev-friendly without demo-first assumptions.
- `staging_pilot`: stricter sharing and rate-limit defaults for pilot rehearsal.
- `production_pilot`: safest defaults, internal guards expected, demo features off unless explicitly allowed.

## If the app is degraded

- Check `/ready` and `/ops/summary`.
- If the state is `read_only_degraded`, mutable routes are intentionally blocked until persistence is healthy again.
- If the state is `degraded`, verify whether fallback-to-cache behavior is acceptable for the current demo or pilot.
- If background jobs are failing, review `/ops/summary` and restart after fixing persistence/connectivity.

## Common support actions

- Revoke a shared snapshot or shortlist link from the existing ops routes before reissuing it.
- Revoke a pilot link from `/pilot/links/:token/revoke`.
- If Postgres was unavailable during startup, bring it back and rerun `yarn db:push`, then restart the API.
- Use `/ops/support/context` when sharing, limits, or mutable-route availability are unclear.

## Compatibility notes

- Older snapshots, shortlist items, notes, comments, reviewer decisions, pilot links, and reliability metadata are still expected to load.
- Missing newer fields should fall back to safe defaults rather than blocking reads.
- Immutable score and snapshot payloads must not be rewritten during recovery or rollback.
