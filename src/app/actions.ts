"use server";

import { Client } from "@temporalio/client";
import { revalidatePath } from "next/cache";

let temporalClient: Client | null = null;

function getTemporalClient(): Client {
  if (!temporalClient) {
    temporalClient = new Client();
  }
  return temporalClient;
}

const workflows: Array<{
  id: string;
  route: string;
  status: string;
  delay: number | null;
  message: string | null;
  startTime: number;
  completedTime?: number;
  notificationData?: {
    message: string;
    route: string;
    delay: number;
    trafficLevel: string;
    distance: number;
    estimatedTime: number;
  };
}> = [];

export async function startTrafficWorkflow(formData: FormData) {
  try {
    const origin = formData.get("origin") as string;
    const destination = formData.get("destination") as string;
    const threshold = Number(formData.get("threshold"));

    if (!origin || !destination || !threshold) {
      throw new Error("Missing required fields");
    }

    const workflowId = `traffic-delay-${Date.now()}`;
    const route = `${origin} → ${destination}`;

    console.log(`Starting workflow ${workflowId} for route: ${route}`);

    const client = getTemporalClient();
    await client.workflow.start("TrafficDelayWorkflow", {
      taskQueue: "traffic-delay",
      workflowId,
      args: [origin, destination, threshold],
    });

    const workflow = {
      id: workflowId,
      route,
      status: "started",
      delay: null,
      message: null,
      startTime: Date.now(),
    };

    workflows.unshift(workflow);
    revalidatePath("/");

    return { success: true, workflow };
  } catch (error) {
    console.error("Failed to start workflow:", error);
    return { success: false, error: "Failed to start workflow" };
  }
}

export async function getWorkflows() {
  try {
    const client = getTemporalClient();

    for (const workflow of workflows) {
      if (workflow.status === "started") {
        try {
          const handle = client.workflow.getHandle(workflow.id);
          const status = await handle.describe();

          if (status.status.name === "COMPLETED") {
            workflow.status = "completed";
            workflow.completedTime = Date.now();

            try {
              const result = await handle.result();
              console.log("Workflow result:", workflow.id, result);
              if (result && typeof result === "object" && "message" in result) {
                workflow.message = result.message;
                workflow.delay = result.delay;
                workflow.notificationData = result;
                console.log(
                  "Workflow completed with result:",
                  workflow.id,
                  result.message,
                  "delay:",
                  result.delay
                );
              }
            } catch (error) {
              console.log(
                "No result data available for workflow:",
                workflow.id,
                error
              );
            }

            console.log(`Workflow ${workflow.id} completed successfully`);
          } else if (status.status.name === "FAILED") {
            workflow.status = "failed";
            workflow.completedTime = Date.now();
            console.log(`Workflow ${workflow.id} failed`);
          } else if (status.status.name === "RUNNING") {
            console.log(`Workflow ${workflow.id} is still running`);
          }
        } catch (error) {
          console.error(
            `Failed to get status for workflow ${workflow.id}:`,
            error
          );
        }
      }
    }

    return workflows;
  } catch (error) {
    console.error("Failed to get workflows:", error);
    return [];
  }
}
