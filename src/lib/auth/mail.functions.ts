import { createServerFn } from "@tanstack/react-start";
import { mailConfigured } from "./mail.server";

export const mailReady = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: mailConfigured() };
});
