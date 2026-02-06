import { ThemeProvider } from "@/lib/theme-context";
import { ProfileProvider } from "@/lib/profile-context";
import { DashboardDataProvider } from "@/lib/dashboard-data-context";
import { UserHoverCardProvider } from "@/components/ui/UserHoverCardProvider";

export default function MainLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <ProfileProvider>
            <ThemeProvider>
                <DashboardDataProvider>
                    <UserHoverCardProvider>
                        {children}
                    </UserHoverCardProvider>
                </DashboardDataProvider>
            </ThemeProvider>
        </ProfileProvider>
    );
}
