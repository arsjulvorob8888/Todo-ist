import { createFileRoute } from "@tanstack/react-router";
import { MoreView } from "@/components/more-view";

export const Route = createFileRoute("/more")({ component: MoreView });
