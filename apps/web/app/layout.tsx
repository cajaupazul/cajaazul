import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://cajaazul.pages.dev'),
  title: "CampusLink | Repositorio estudiantil para la comunidad UP",
  description: "Repositorio estudiantil independiente con materiales, referencias, grupos y herramientas para la comunidad de la Universidad del Pacífico.",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "CampusLink | Repositorio estudiantil para la comunidad UP",
    description: "Repositorio estudiantil independiente con materiales, referencias, grupos y herramientas para la comunidad de la Universidad del Pacífico.",
    siteName: "CampusLink",
    locale: "es_PE",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CampusLink | Repositorio estudiantil para la comunidad UP",
    description: "Repositorio estudiantil independiente con materiales, referencias, grupos y herramientas para la comunidad de la Universidad del Pacífico.",
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
