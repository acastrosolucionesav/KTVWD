import type { Metadata } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "KTV — Sistema Comercial",
  description: "Cotizador interno KTV Working Drone Colombia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#F7FBFF]">
        <NavBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
