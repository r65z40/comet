import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "COMET CEDELIA",
  description: "Suivi des équipements, produits et services installés chez les clients",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
