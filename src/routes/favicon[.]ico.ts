import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/favicon.ico")({
  server: {
    handlers: {
      GET: async () => {
        const { faviconResponse } = await import("@/lib/favicon");
        return faviconResponse();
      },
    },
  },
});
