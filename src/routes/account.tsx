import { createFileRoute } from "@tanstack/react-router";
import { AccountView } from "@/components/account-view";

export const Route = createFileRoute("/account")({ component: AccountView });
