import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Funil 11:22",
  description: "Recuperação e upsell do funil 11:22",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
