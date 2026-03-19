import type { Metadata } from "next";
import "./globals.css";
import DynamicFavicon from "@/components/DynamicFavicon";

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
    <html lang="fr">
      <body className="antialiased">
        <DynamicFavicon />
        {children}
      </body>
    </html>
  );
}
