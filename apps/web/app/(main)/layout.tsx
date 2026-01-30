import { ThemeProvider } from "@/lib/theme-context";
import { ProfileProvider } from "@/lib/profile-context";
import { DashboardDataProvider } from "@/lib/dashboard-data-context";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProfileProvider>
            <ThemeProvider>
                <DashboardDataProvider>
                    {children}
                </DashboardDataProvider>
            </ThemeProvider>
        </ProfileProvider>
    );
}
