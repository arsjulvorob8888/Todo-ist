import { createFileRoute } from "@tanstack/react-router";
import { GoalsView } from "@/components/goals-view";

export const Route = createFileRoute("/goals")({ component: GoalsView });
