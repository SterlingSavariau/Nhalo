import type { GoLiveCheckSummary } from "@nhalo/types";
import { withOpsApp, printSection } from "./ops-common";

async function main() {
  await withOpsApp(async ({ app, internalHeaders }) => {
    const response = await app.inject({
      method: "GET",
      url: "/ops/go-live-check?source=script",
      headers: internalHeaders
    });

    if (response.statusCode !== 200) {
      process.stderr.write(`ops:check failed: ${response.body}\n`);
      process.exitCode = 1;
      return;
    }

    const payload = response.json() as { summary: GoLiveCheckSummary };
    const { summary } = payload;

    printSection(`Go-live readiness: ${summary.overallStatus.toUpperCase()}`);
    process.stdout.write(
      `${summary.environment} / ${summary.profile} · reliability ${summary.reliabilityState}\n`
    );

    printSection("Checks");
    for (const check of summary.checks) {
      process.stdout.write(`[${check.status}] ${check.label}: ${check.detail}\n`);
    }

    if (summary.guardrails.length > 0) {
      printSection("Guardrails");
      for (const guardrail of summary.guardrails) {
        process.stdout.write(`[${guardrail.status}] ${guardrail.message} (${guardrail.detail})\n`);
      }
    }

    if (summary.overallStatus === "fail") {
      process.exitCode = 1;
    }
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
