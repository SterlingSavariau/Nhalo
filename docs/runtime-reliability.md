## Runtime Reliability Notes

### Environment behavior

- `local` and `development` default to lower-friction behavior such as demo tooling and looser public-sharing defaults.
- `staging` and `production_like_pilot` default to safer behavior with stricter sharing and startup expectations.
- Runtime environment selection is centralized in `packages/config/src/index.ts`.

### Startup vs degraded runtime

- Required dependencies can block startup in strict production-like modes.
- Optional dependencies do not block startup, but they move the runtime into an explicit degraded state.
- Database degradation can force `read_only_degraded`, which blocks mutable workflow and ops routes while keeping read paths available where possible.

### Reliability states

- `healthy`: no active degraded conditions.
- `degraded`: the app is serving traffic with non-blocking issues.
- `maintenance`: reserved for controlled maintenance states.
- `read_only_degraded`: mutable writes are blocked because persistence guarantees are degraded.
- `startup_blocked`: a required startup dependency is unavailable.

### Background jobs

- Background cleanup jobs are best-effort maintenance tasks.
- Job start, completion, and failure are logged and surfaced in reliability summaries.
- Job failures do not crash the process, but repeated failures keep the runtime in a degraded state until a later successful run clears the condition.

### Compatibility and rollback expectations

- Immutable stored artifacts must remain readable even when newer metadata fields are absent.
- New reliability metadata is additive and should not be required for older snapshots, history records, or shared views.
- Rollbacks must not rewrite or "upgrade" immutable stored payloads in place.

### Logging and incidents

- Reliability incidents are lightweight operational records separate from score and snapshot audit data.
- Structured logs should explain degraded reasons, cache-only mode, write blocking, and startup dependency state without exposing secrets.
