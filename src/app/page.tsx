"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  LoaderCircle,
  Bell,
  X,
  Clock,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { startTrafficWorkflow, getWorkflows } from "./actions";
import { v4 as uuidv4 } from "uuid";

const delayThresholdOptions = [5, 10, 15, 20, 30];

interface WorkflowProgress {
  id: string;
  route: string;
  status: string;
  delay: number | null;
  message: string | null;
  startTime: number;
  completedTime?: number;
}

interface Notification {
  id: string;
  message: string;
  route: string;
  delay: number;
  timestamp: number;
  type: "delay" | "completed" | "error";
}

export default function Page() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [threshold, setThreshold] = useState(30);
  const [workflows, setWorkflows] = useState<WorkflowProgress[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  const processedWorkflows = useRef<Set<string>>(new Set());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("origin", origin);
      formData.append("destination", destination);
      formData.append("threshold", String(threshold));

      const result = await startTrafficWorkflow(formData);

      if (result.success && result.workflow) {
        setWorkflows((prev) => [result.workflow as WorkflowProgress, ...prev]);
        setOrigin("");
        setDestination("");
      } else {
        console.error("Failed to start workflow:", result.error);
      }
    } catch (error) {
      console.error("Failed to start workflow:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getWorkflows();
        setWorkflows(data);

        // Check for new completed workflows with delay notifications
        data.forEach((workflow) => {
          if (
            workflow.status === "completed" &&
            workflow.message &&
            workflow.completedTime &&
            workflow.delay &&
            workflow.delay > 0 &&
            workflow.message !== "No significant delay detected" &&
            !processedWorkflows.current.has(workflow.id)
          ) {
            console.log(
              "Creating notification for workflow:",
              workflow.id,
              workflow.message
            );
            const notification: Notification = {
              id: uuidv4(),
              message: workflow.message,
              route: workflow.route,
              delay: workflow.delay,
              timestamp: workflow.completedTime,
              type: "delay",
            };
            setNotifications((prev) => [notification, ...prev]);
            processedWorkflows.current.add(workflow.id);
          }
        });
      } catch (error) {
        console.error("Failed to fetch workflows:", error);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [threshold]);

  const clearNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "delay":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s ago`;
    }
    return `${seconds}s ago`;
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <main className="max-w-4xl mx-auto py-12 px-4">
          <h1 className="text-3xl font-bold mb-8">Traffic Delay Monitor</h1>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 mb-8 p-6 border rounded-lg bg-card"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="origin" className="text-sm font-medium">
                  Origin
                </label>
                <Input
                  id="origin"
                  name="origin"
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  placeholder="Enter origin address"
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="destination" className="text-sm font-medium">
                  Destination
                </label>
                <Input
                  id="destination"
                  name="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Enter destination address"
                  required
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label htmlFor="threshold" className="text-sm font-medium">
                Delay Threshold (min)
              </label>
              <select
                id="threshold"
                name="threshold"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="h-10 px-3 py-2 border rounded-md bg-background text-sm"
              >
                {delayThresholdOptions.map((min) => (
                  <option key={min} value={min}>
                    {min}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Monitoring"
                )}
              </Button>
            </div>
          </form>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Workflow Progress</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delay (min)</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-muted-foreground py-8"
                    >
                      No workflows started yet
                    </TableCell>
                  </TableRow>
                ) : (
                  workflows.map((workflow) => (
                    <TableRow key={workflow.id}>
                      <TableCell className="font-medium">
                        {workflow.route}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            workflow.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : workflow.status === "failed"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {workflow.status}
                        </span>
                      </TableCell>
                      <TableCell>{workflow.delay ?? "-"}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {workflow.message ?? "-"}
                      </TableCell>
                      <TableCell>
                        {workflow.completedTime
                          ? `${Math.round(
                              (workflow.completedTime - workflow.startTime) /
                                1000
                            )}s`
                          : `${Math.round(
                              (Date.now() - workflow.startTime) / 1000
                            )}s`}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </main>
      </div>

      {/* Notification Inbox Panel */}
      <div
        className={`w-96 border-l bg-white shadow-lg transition-all duration-300 ${
          showNotifications ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Notifications</h3>
              {notifications.length > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                  {notifications.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllNotifications}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear All
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNotifications(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto h-[calc(100vh-80px)]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Bell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No notifications yet</p>
              <p className="text-sm">AI-generated messages will appear here</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-lg border-l-4 ${
                    notification.type === "delay"
                      ? "border-red-500 bg-red-50"
                      : notification.type === "error"
                      ? "border-red-500 bg-red-50"
                      : "border-green-500 bg-green-50"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getNotificationIcon(notification.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {notification.route}
                        </p>
                        <p className="text-sm text-gray-700 mb-2">
                          {notification.message}
                        </p>
                        {notification.delay > 0 && (
                          <p className="text-xs text-gray-500">
                            Delay: {notification.delay} minutes
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatTime(notification.timestamp)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearNotification(notification.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toggle Button for Notifications */}
      {!showNotifications && (
        <div className="fixed bottom-4 right-4">
          <Button
            onClick={() => setShowNotifications(true)}
            className="rounded-full w-12 h-12 p-0 shadow-lg"
          >
            <Bell className="h-5 w-5" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {notifications.length}
              </span>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
