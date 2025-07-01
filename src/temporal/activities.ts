import OpenAI from "openai";
import {
  Client,
  TravelMode,
  TrafficModel,
} from "@googlemaps/google-maps-services-js";
import sgMail from "@sendgrid/mail";

let openaiClient: OpenAI | null = null;
let googleMapsClient: Client | null = null;
let sendGridInitialized = false;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

function getGoogleMapsClient(): Client {
  if (!googleMapsClient) {
    googleMapsClient = new Client({});
  }
  return googleMapsClient;
}

function getSendGridClient() {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY environment variable is not set");
  }
  if (!sendGridInitialized) {
    sgMail.setApiKey(apiKey);
    sendGridInitialized = true;
  }
  return sgMail;
}

export interface TrafficData {
  origin: string;
  destination: string;
  currentTime: number;
  estimatedTime: number;
  trafficLevel: "low" | "medium" | "high";
  distance: number;
  duration: number;
  durationInTraffic: number;
}

export interface NotificationData {
  message: string;
  route: string;
  delay: number;
  trafficLevel: string;
  distance: number;
  estimatedTime: number;
}

export async function checkTrafficConditions(
  origin: string,
  destination: string
): Promise<TrafficData> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_MAPS_API_KEY environment variable is not set");
    }

    const client = getGoogleMapsClient();
    const response = await client.distancematrix({
      params: {
        origins: [origin],
        destinations: [destination],
        mode: TravelMode.driving,
        traffic_model: TrafficModel.best_guess,
        departure_time: Math.floor(Date.now() / 1000),
        key: apiKey,
      },
    });

    console.log(
      "Google Maps API response:",
      JSON.stringify(response.data, null, 2)
    );

    const element = response.data.rows[0].elements[0];

    if (element.status === "OK") {
      const duration = element.duration.value / 60;
      const distance = element.distance.value / 1000;
      const durationInTraffic =
        element.duration_in_traffic?.value / 60 || duration;

      const delay = Math.max(0, durationInTraffic - duration);
      const trafficLevel = delay < 5 ? "low" : delay < 15 ? "medium" : "high";

      return {
        origin,
        destination,
        currentTime: Date.now(),
        estimatedTime: durationInTraffic,
        trafficLevel,
        distance,
        duration,
        durationInTraffic,
      };
    } else {
      throw new Error(`Google Maps API error: ${element.status}`);
    }
  } catch (error) {
    //Note:  This is just a sample fallback to make it easy to work without google api key, should not be used in production
    console.error("Failed to get traffic data from Google Maps:", error);

    const baseTime = 30;
    const trafficMultipliers = {
      low: 1.0,
      medium: 1.5,
      high: 2.5,
    };

    const trafficLevel =
      Math.random() > 0.7 ? "high" : Math.random() > 0.4 ? "medium" : "low";
    const currentTime = Date.now();
    const estimatedTime = baseTime * trafficMultipliers[trafficLevel];

    return {
      origin,
      destination,
      currentTime,
      estimatedTime,
      trafficLevel,
      distance: 25,
      duration: 30,
      durationInTraffic: estimatedTime,
    };
  }
}

export async function calculateDelay(
  trafficData: TrafficData
): Promise<number> {
  const delay = Math.max(
    0,
    trafficData.durationInTraffic - trafficData.duration
  );
  const roundedDelay = Math.round(delay);
  console.log("Calculated delay:", roundedDelay);
  return roundedDelay;
}

export async function generateNotificationMessage(props: {
  delay: number;
  threshold: number;
  trafficData: TrafficData;
}): Promise<NotificationData> {
  const { delay, threshold, trafficData } = props;
  console.log("Generating notification message for:", {
    origin: trafficData.origin,
    destination: trafficData.destination,
    delay,
    threshold,
  });

  try {
    const client = getOpenAIClient();

    const trafficContext = {
      origin: trafficData.origin,
      destination: trafficData.destination,
      currentTime: new Date(trafficData.currentTime).toISOString(),
      estimatedTime: Math.round(trafficData.estimatedTime),
      trafficLevel: trafficData.trafficLevel,
      distance: trafficData.distance.toFixed(1),
      normalDuration: Math.round(trafficData.duration),
      durationInTraffic: Math.round(trafficData.durationInTraffic),
      delay: delay,
      delayPercentage: Math.round((delay / trafficData.duration) * 100),
      threshold: threshold,
      thresholdExceeded: delay > threshold,
    };

    const prompt = `Generate a professional freight delivery delay notification message using the following comprehensive traffic data:

TRAFFIC DATA CONTEXT:
'''
${JSON.stringify(trafficContext, null, 2)}
'''

The message should:
- Be professional and informative for freight delivery customers
- Include relevant details about the delay and traffic conditions
- Be concise but helpful (maximum 200 characters)
- Use appropriate emojis sparingly
- Consider the traffic level (${trafficData.trafficLevel}) and delay severity
- Note that this delay (${delay} min) exceeds the acceptable standards
- Don't mention our threshold to the final message

Return only the message text, no additional formatting.`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional freight delivery notification system. Generate clear, concise, and informative delay notifications for customers. Use the comprehensive traffic data provided to create personalized messages that help customers understand the delay situation and its impact on their delivery.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const message =
      completion.choices[0].message.content || "Delay notification generated";
    console.log("AI message generated:", message);

    const result = {
      message,
      route: `${trafficData.origin} → ${trafficData.destination}`,
      delay,
      trafficLevel: trafficData.trafficLevel,
      distance: trafficData.distance,
      estimatedTime: trafficData.durationInTraffic,
    };

    console.log("Generated notification result:", result);
    return result;
  } catch (error) {
    console.error("Failed to generate message with OpenAI:", error);

    const messages = [
      `🚚 Delivery Alert: Freight from ${trafficData.origin} to ${trafficData.destination} delayed by ${delay} minutes due to traffic.`,
      `⚠️ Traffic Update: Route ${trafficData.origin} → ${trafficData.destination} has ${delay}-minute delay.`,
      `📦 Delivery Delay: ${delay} minutes added to ${trafficData.origin} → ${trafficData.destination} route.`,
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];
    console.log("AI fallback message generated:", message);

    const result = {
      message,
      route: `${trafficData.origin} → ${trafficData.destination}`,
      delay,
      trafficLevel: trafficData.trafficLevel,
      distance: trafficData.distance,
      estimatedTime: trafficData.durationInTraffic,
    };

    console.log("Generated fallback notification result:", result);
    return result;
  }
}

export async function sendNotification(
  notificationData: NotificationData
): Promise<NotificationData> {
  console.log("📧 Sending notification:", notificationData.message);

  let sent = false;
  try {
    const sendGridClient = getSendGridClient();
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">🚚 Freight Delivery Delay Alert</h2>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0 0 15px 0; font-size: 16px;"><strong>${
            notificationData.message
          }</strong></p>
        </div>
        <div style="background-color: #e9ecef; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3 style="margin: 0 0 10px 0; color: #495057;">Route Details</h3>
          <p style="margin: 5px 0;"><strong>Route:</strong> ${
            notificationData.route
          }</p>
          <p style="margin: 5px 0;"><strong>Delay:</strong> ${
            notificationData.delay
          } minutes</p>
          <p style="margin: 5px 0;"><strong>Distance:</strong> ${notificationData.distance.toFixed(
            1
          )} km</p>
          <p style="margin: 5px 0;"><strong>Traffic Level:</strong> ${
            notificationData.trafficLevel
          }</p>
          <p style="margin: 5px 0;"><strong>Estimated Travel Time:</strong> ${Math.round(
            notificationData.estimatedTime
          )} minutes</p>
        </div>
        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6;">
          <p style="color: #6c757d; font-size: 14px; margin: 0;">
            This is an automated notification from your freight monitoring system.
          </p>
        </div>
      </div>
    `;
    const msg = {
      to: process.env.NOTIFICATION_EMAIL || "customer@example.com",
      from: process.env.FROM_EMAIL || "noreply@yourcompany.com",
      subject: `🚚 Delivery Delay Alert: ${notificationData.route}`,
      text: notificationData.message,
      html: emailContent,
    };
    await sendGridClient.send(msg);
    sent = true;
    console.log("✅ Email notification sent successfully via SendGrid");
  } catch (error) {
    console.error("Failed to send email notification:", error);
  }
  if (sent) {
    console.log("✅ email notification sent successfully");
  } else {
    console.log("⚠️ email notification skipped or failed");
  }
  return notificationData;
}
