import { createFileRoute } from "@tanstack/react-router";
import { LibraryView } from "@/components/more-view";

export const Route = createFileRoute("/books")({
  validateSearch: (search: Record<string, unknown>) => ({
    shelf: (search.shelf === "queue" || search.shelf === "read" ? search.shelf : "lists") as "lists" | "queue" | "read",
  }),
  component: BooksPage,
});

function BooksPage() {
  const { shelf } = Route.useSearch();
  return <LibraryView section="books" shelf={shelf} />;
}
