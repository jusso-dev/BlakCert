import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? "/overview" : "/sign-in");
}
