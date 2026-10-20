import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/time")({
  beforeLoad: () => {
    throw redirect({ to: "/timing" });
  },
});
