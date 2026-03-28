import type { DemoScenario } from "@nhalo/types";
import { getConfig } from "@nhalo/config";
import { withOpsApp, printSection } from "./ops-common";

async function main() {
  const config = getConfig();

  await withOpsApp(async ({ app }) => {
    const response = await app.inject({
      method: "GET",
      url: "/validation/demo-scenarios"
    });

    if (response.statusCode === 404) {
      printSection("Demo scenarios");
      process.stdout.write(
        `Demo scenarios are disabled for profile ${config.deployment.profile}.\n`
      );
      if (config.deployment.profile === "local_demo") {
        process.exitCode = 1;
      }
      return;
    }

    if (response.statusCode !== 200) {
      process.stderr.write(`ops:seed:verify failed: ${response.body}\n`);
      process.exitCode = 1;
      return;
    }

    const payload = response.json() as { scenarios: DemoScenario[] };

    printSection(`Demo scenarios (${payload.scenarios.length})`);
    for (const scenario of payload.scenarios) {
      process.stdout.write(`${scenario.id}: ${scenario.title}\n`);
    }
  });
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
