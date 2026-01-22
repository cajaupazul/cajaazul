import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/theme-context";
import { ProfileProvider } from "@/lib/profile-context";
import { DashboardDataProvider } from "@/lib/dashboard-data-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusLink - Plataforma Premium",
  description: "Plataforma educativa premium para gestión de cursos",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'edge';

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
        <ProfileProvider>
          <ThemeProvider>
            <DashboardDataProvider>
              {children}
            </DashboardDataProvider>
          </ThemeProvider>
        </ProfileProvider>
      </body>
    </html>
  );
}