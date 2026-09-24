import type { Metadata, Viewport } from "next";
import { Inter, Orbitron } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const orbitron = Orbitron({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-orbitron" });

export const metadata: Metadata = {
  title: "Kroma Leads",
  description: "Captação e prospecção de leads — Kroma Projetos",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#0d0f12", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${orbitron.variable}`}>
      <body>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          richColors
          toastOptions={{ style: { background: "#1a1d23", border: "1px solid #262b33", color: "#e0e0e0" } }}
        />
      </body>
    </html>
  );
}
