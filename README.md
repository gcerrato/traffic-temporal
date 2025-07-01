# Traffic Delay Monitor

A Next.js application that monitors traffic delays on freight delivery routes using Temporal workflows. The app provides a UI for entering delivery routes and displays real-time workflow progress with notifications for significant delays.

## Prerequisites

- Node.js 18+ and pnpm
- Docker and Docker Compose (for Temporal server)
- OpenAI API key
- Google Maps API key
- SendGrid API key

## Setup

1. **Install dependencies**:
   ```bash
   pnpm install
   ```

2. **Create environment file**

   ```
   Use the .env.example as base
   ```

3. **Start Temporal server**:
   ```bash
   docker-compose up -d
   ```

4. **Start the Temporal worker** (in a separate terminal):
   ```bash
   pnpm worker
   ```

5. **Start the Next.js development server**:
   ```bash
   pnpm dev
   ```

6. **Open your browser** and navigate to `http://localhost:3000`

## Services

The docker-compose setup includes:
- **PostgreSQL**: Database for Temporal
- **Temporal**: Workflow orchestration server
- **Temporal UI**: Web interface at `http://localhost:8080`
- **Temporal Admin Tools**: CLI tools for management

## How it Works

1. **Route Input**: Users enter origin, destination, and delay threshold
2. **Workflow Start**: Server action starts a Temporal workflow
3. **Traffic Check**: Google Maps API provides real traffic data
4. **Delay Calculation**: Computes actual delay based on traffic conditions
5. **AI Message Generation**: OpenAI generates custom delay messages
6. **Email Notification**: SendGrid sends professional email alerts
7. **Real-time Updates**: UI polls for workflow status updates every 3 seconds

## Architecture

- **Frontend**: Next.js 15 with React 19
- **Backend**: Next.js server actions for workflow management
- **Workflow Engine**: Temporal for reliable workflow orchestration
- **External APIs**: OpenAI for message generation, Google Maps for traffic data, SendGrid for email
- **Database**: PostgreSQL (via Docker Compose)

## Server Actions

- `startTrafficWorkflow` - Start a new traffic monitoring workflow
- `getWorkflows` - Get all workflow statuses

## Temporal Workflow

The `TrafficDelayWorkflow` consists of four independent activities:

1. `checkTrafficConditions` - Google Maps API for real traffic data
2. `calculateDelay` - Computes delay based on traffic vs normal conditions
3. `generateNotificationMessage` - OpenAI generates custom delay messages
4. `sendNotification` - SendGrid sends professional email notifications
