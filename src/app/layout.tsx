import type { Metadata } from "next";
import "./globals.css";
import DynamicFavicon from "@/components/DynamicFavicon";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "COMET - CEDELIA",
  description: "Suivi des équipements, produits et services installés chez les clients",
  icons: {
    icon: "/logo.svg",
    apple: "/logo-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('comet_theme');
            const dark = t === 'dark' || (!t || t === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (dark) document.documentElement.classList.add('dark');
          } catch {}
        ` }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <DynamicFavicon />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
