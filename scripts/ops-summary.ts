import type { ReleaseSummary, SupportContextSummary } from "@nhalo/types";
import { withOpsApp, printSection } from "./ops-common";

async function main() {
  await withOpsApp(async ({ app, internalHeaders }) => {
    const [releaseResponse, supportResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/ops/release-summary",
        headers: internalHeaders
      }),
      app.inject({
        method: "GET",
        url: "/ops/support/context",
        headers: internalHeaders
      })
    ]);

    if (releaseResponse.statusCode !== 200) {
      process.stderr.write(`ops:summary release fetch failed: ${releaseResponse.body}\n`);
      process.exitCode = 1;
      return;
    }

    if (supportResponse.statusCode !== 200) {
      process.stderr.write(`ops:summary support fetch failed: ${supportResponse.body}\n`);
      process.exitCode = 1;
      return;
    }

    const release = (releaseResponse.json() as { summary: ReleaseSummary }).summary;
    const support = (supportResponse.json() as { support: SupportContextSummary }).support;

    printSection("Release summary");
    process.stdout.write(
      `${release.build.appVersion} · ${release.build.buildId} · ${release.environment} / ${release.profile}\n`
    );
    process.stdout.write(
      `features: ${release.enabledFeatures.join(", ") || "none"}\n`
    );
    process.stdout.write(
      `constraints: ${release.degradedConstraints.join(" · ") || "none"}\n`
    );

    printSection("Support context");
    for (const item of support.items) {
      process.stdout.write(`[${item.status}] ${item.title}: ${item.summary}\n`);
    }
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
