import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Ligature — open-source brand identity studio",
  description:
    "Brief → strategy → logo → color → type → imagery → motion → mockups → guidelines. One Brand Genome, every stage of identity design, powered by free AI providers.",
};

export const viewport: Viewport = {
  themeColor: "#1b1b1f",
};

const themeScript = `
try {
  const t = localStorage.getItem('ligature:theme');
  if (t === 'light') document.documentElement.classList.add('light');
} catch {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster theme="system" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
