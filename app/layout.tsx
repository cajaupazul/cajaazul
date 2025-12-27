import type { Metadata } from "next";
import { ThemeProvider } from "@/lib/theme-context";
import { ProfileProvider } from "@/lib/profile-context";
import { DashboardDataProvider } from "@/lib/dashboard-data-context";
import { createClient } from "@/lib/supabase-server";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusLink - Plataforma Premium",
  description: "Plataforma educativa premium para gestión de cursos",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  // Fetch initial profile data on server for hydration
  let initialProfile = null;
  if (session?.user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    initialProfile = data;
  }

  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body className="bg-bb-dark text-bb-text antialiased">
        <ThemeProvider initialFaculty={initialProfile?.carrera}>
          <ProfileProvider initialSession={session} initialProfile={initialProfile}>
            <DashboardDataProvider>
              {children}
            </DashboardDataProvider>
          </ProfileProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}