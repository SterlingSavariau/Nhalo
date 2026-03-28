# Nhalo Demo Runbook

## Before the demo

- Use `APP_ENV_PROFILE=local_demo` for local demos.
- Confirm `VITE_ENABLE_DEMO_MODE=true`.
- Run `yarn ops:seed:verify` to confirm demo scenarios are available.
- Run `yarn ops:check` to make sure launch guardrails are not failing.

## Demo-safe flow

1. Open the web app.
2. Load a demo scenario from the demo panel.
3. Run the search.
4. Save a snapshot.
5. Use the shared snapshot flow for a read-only external view.
6. Use shortlist/share only if the active profile and partner capabilities allow it.

## What to verify

- Shared pages clearly show stored, read-only framing.
- Provider modes match the demo plan.
- No internal-only diagnostics appear on public or shared views.
- Reliability state is acceptable for a pilot conversation.

## If something looks wrong

- Blank or broken UI: restart `yarn dev:web` and hard refresh.
- Sharing disabled: check `/ops/support/context` and public sharing flags.
- Mutable features blocked: check whether the app is in `read_only_degraded`.
- No demo scenarios: confirm `APP_ENV_PROFILE`, `VALIDATION_MODE`, and `ENABLE_DEMO_SCENARIOS`.
