import { createFileRoute } from "@tanstack/react-router";
import { TimingView } from "@/components/timing-view";

export const Route = createFileRoute("/timing")({ component: TimingView });
