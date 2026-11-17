import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/integrations/kremlin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { postKremlinIngest } = await import("@/lib/kremlin-ingest.server");
        return postKremlinIngest(request);
      },
    },
  },
});
