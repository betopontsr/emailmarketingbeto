import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { logoutAction } from "@/app/login/actions";
import { NavLinks } from "@/components/painel/nav-links";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: LayoutProps<"/">) {
  const admin = await requireAdminPage();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 md:block">
          <Link href="/" className="font-semibold">
            Funil 11:22
          </Link>
          <p className="hidden truncate text-xs text-muted-foreground md:mt-1 md:block">{admin.email}</p>
        </div>
        <NavLinks />
        <form action={logoutAction} className="p-4">
          <button className="text-xs text-muted-foreground hover:underline">Sair</button>
        </form>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
