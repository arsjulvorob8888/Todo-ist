import { createFileRoute } from "@tanstack/react-router";
import { LibraryView } from "@/components/more-view";

export const Route = createFileRoute("/projects")({ component: () => <LibraryView section="project" /> });
