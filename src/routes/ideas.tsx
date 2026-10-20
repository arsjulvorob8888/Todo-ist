import { createFileRoute } from "@tanstack/react-router";
import { LibraryView } from "@/components/more-view";

export const Route = createFileRoute("/ideas")({ component: () => <LibraryView section="ideas" /> });
