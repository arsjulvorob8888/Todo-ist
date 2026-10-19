import { createFileRoute } from "@tanstack/react-router";
import { Today } from "@/components/today";

export const Route = createFileRoute("/")({ component: Today });
