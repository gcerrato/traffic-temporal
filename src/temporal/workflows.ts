import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "./activities";

const {
  checkTrafficConditions,
  calculateDelay,
  generateNotificationMessage,
  sendNotification,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute",
});

export async function TrafficDelayWorkflow(
  origin: string,
  destination: string,
  threshold: number
): Promise<{ message: string; delay: number }> {
  const trafficData = await checkTrafficConditions(origin, destination);
  const delay = await calculateDelay(trafficData);

  if (delay > threshold) {
    console.log(
      `Delay ${delay} exceeds threshold ${threshold}, generating notification`
    );

    const notificationData = await generateNotificationMessage({
      delay,
      threshold,
      trafficData,
    });

    console.log("Generated notification data:", notificationData);

    const sentNotification = await sendNotification(notificationData);

    const result = {
      message: sentNotification.message,
      delay: sentNotification.delay,
    };

    console.log("Returning workflow result:", result);
    return result;
  }

  console.log(
    `Delay ${delay} does not exceed threshold ${threshold}, no notification`
  );

  return {
    message: "No significant delay detected",
    delay,
  };
}
