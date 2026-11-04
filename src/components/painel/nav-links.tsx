"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Visão geral" },
  { href: "/clientes", label: "Clientes" },
  { href: "/desempenho", label: "Desempenho" },
  { href: "/fila", label: "Fila de envios" },
  { href: "/eventos", label: "Eventos (webhooks)" },
  { href: "/produtos", label: "Produtos" },
  { href: "/templates", label: "E-mails (prévia)" },
  { href: "/configuracoes", label: "Configurações" },
  { href: "/simulador", label: "Simulador" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-accent",
              active && "bg-accent font-medium",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
