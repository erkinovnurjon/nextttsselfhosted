import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { CabinetShell } from "@/components/cabinet/cabinet-shell";

export const dynamic = "force-dynamic";

export default async function CabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/cabinet");
  }

  return (
    <CabinetShell
      user={{
        name: session.user.name ?? null,
        email: session.user.email ?? null,
        role: session.user.role ?? "user",
      }}
    >
      {children}
    </CabinetShell>
  );
}
