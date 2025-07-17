import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import {
  Bot,
  Users,
  Server,
  Settings,
  LayoutDashboard,
  ScrollText,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
    icon: React.ReactNode;
  }[];
}

export function Sidebar({ className, items = [], ...props }: SidebarNavProps) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="pb-12 h-full">
      <div className="space-y-4 py-4">
        <div className="px-3 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
            AI Platform
          </h2>
          <div className="space-y-1">
            {items.map((item) => (
              <Button
                key={item.href}
                variant={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                    ? "secondary"
                    : "ghost"
                }
                className={cn(
                  "w-full justify-start",
                  pathname === item.href && "bg-muted"
                )}
                asChild
              >
                <Link to={item.href}>
                  {item.icon}
                  {item.title}
                </Link>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MainSidebar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const sidebarNavItems = [
    {
      title: "Dashboard",
      href: "/",
      icon: <LayoutDashboard className="mr-2 h-4 w-4" />,
    },
    {
      title: "Agents",
      href: "/agents",
      icon: <Bot className="mr-2 h-4 w-4" />,
    },
    {
      title: "Crews",
      href: "/crews",
      icon: <Users className="mr-2 h-4 w-4" />,
    },
    {
      title: "MCP Servers",
      href: "/mcp-servers",
      icon: <Server className="mr-2 h-4 w-4" />,
    },
    {
      title: "Logs",
      href: "/logs",
      icon: <ScrollText className="mr-2 h-4 w-4" />,
    },
    {
      title: "Settings",
      href: "/settings",
      icon: <Settings className="mr-2 h-4 w-4" />,
    },
  ];

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="sm"
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      >
        {isMobileMenuOpen ? (
          <X className="h-4 w-4" />
        ) : (
          <Menu className="h-4 w-4" />
        )}
      </Button>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen w-64 border-r bg-background transition-transform",
          isMobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        <Sidebar items={sidebarNavItems} />
      </aside>
    </>
  );
}
