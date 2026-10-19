import { createFileRoute } from "@tanstack/react-router";
import { TasksView } from "@/components/tasks-view";

export const Route = createFileRoute("/tasks")({ component: TasksView });
