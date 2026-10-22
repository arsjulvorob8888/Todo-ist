import { createFileRoute } from "@tanstack/react-router";
import { HabitsView } from "@/components/habits-view";

export const Route = createFileRoute("/habits")({ component: HabitsView });
