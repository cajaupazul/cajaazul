import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://cajaazul.pages.dev'),
  title: "CajaAzul | Comunidad académica",
  description: "Materiales, profesores, grupos y herramientas para tomar mejores decisiones académicas.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "CajaAzul | Comunidad académica",
    description: "Materiales, profesores, grupos y herramientas para tomar mejores decisiones académicas.",
    siteName: "CajaAzul",
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CajaAzul | Comunidad académica",
    description: "Materiales, profesores, grupos y herramientas para tomar mejores decisiones académicas.",
  },
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
