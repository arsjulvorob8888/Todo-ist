import { createFileRoute } from "@tanstack/react-router";
import { RoutineView } from "@/components/routine-view";

export const Route = createFileRoute("/routine")({ component: RoutineView });
