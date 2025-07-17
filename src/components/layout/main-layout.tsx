import { MainSidebar } from "@/components/layout/sidebar";
import { Toaster } from "@/components/ui/sonner";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <MainSidebar />

      <div className="flex-1">
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>

      <Toaster position="bottom-right" />
    </div>
  );
}
