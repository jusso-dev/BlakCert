import { redirect } from "next/navigation";
import { requirePageSession } from "@/auth/session";
import { resolveActiveOrganisation } from "@/auth/active-organisation";
import { AppShell } from "@/components/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePageSession();
  const organisation = await resolveActiveOrganisation(session.user.id);
  if (!organisation) redirect("/onboarding");
  return (
    <AppShell organisationName={organisation.name} userName={session.user.name}>
      {children}
    </AppShell>
  );
}
