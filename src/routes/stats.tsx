import { createFileRoute } from "@tanstack/react-router";
import { StatsView } from "@/components/stats-view";

export const Route = createFileRoute("/stats")({ component: StatsView });
