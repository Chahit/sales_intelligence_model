import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "Consistent AI — Sales Intelligence Suite",
  description: "AI-powered partner intelligence, clustering, and sales performance platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ background: "#f7f9fb", color: "#191c1e", fontFamily: "'Inter', system-ui, sans-serif" }}>
        <Providers>
          <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
            <Sidebar />
            <main style={{ flex: 1, overflowY: "auto", background: "#f7f9fb" }}>
              <div style={{ padding: "2rem 2.25rem", minHeight: "100%", maxWidth: 1400, margin: "0 auto" }}>
                {children}
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

