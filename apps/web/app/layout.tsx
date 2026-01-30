import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusLink - Plataforma Premium",
  description: "Plataforma educativa premium para gestión de cursos",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="bg-bb-dark text-bb-text antialiased">
        {children}
      </body>
    </html>
  );
}
