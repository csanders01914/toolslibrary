import { auth } from "@/auth";
import HelpClient from "./HelpClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Request Help — ToolsLibrary",
  description: "Triage-assisted help requests: automated agent resolution or human admin intervention.",
};

export default async function HelpPage() {
  const session = await auth();

  return (
    <HelpClient
      authenticatedAlias={session?.user?.alias ?? null}
    />
  );
}
