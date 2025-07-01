import "dotenv/config";
import { Worker } from "@temporalio/worker";
import * as activities from "./activities";
import { validateEnvironmentVariables } from "../lib/env";

async function run() {
  validateEnvironmentVariables();

  const worker = await Worker.create({
    workflowsPath: require.resolve("./workflows"),
    activities,
    taskQueue: "traffic-delay",
  });

  console.log("🚀 Temporal worker started successfully");
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
