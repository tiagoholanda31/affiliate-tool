import type { Metadata, Viewport } from "next";
import { Playfair_Display, Poppins } from "next/font/google";
import { connection } from "next/server";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_URL } from "@/lib/env";

import "./globals.css";

// Poppins para tudo; Playfair só em H1 e números-destaque (docs/spec/05).
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-poppins",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--font-playfair",
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Affiliate Tool · Programa de Afiliados",
    template: "%s · Affiliate Tool",
  },
  description: "Divulgue os serviços e materiais do Affiliate Tool e acompanhe suas comissões.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#00172d",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Nonce da CSP é por request; páginas estáticas não receberiam o carimbo.
  await connection();

  return (
    <html lang="pt-BR" className={`${poppins.variable} ${playfair.variable}`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
