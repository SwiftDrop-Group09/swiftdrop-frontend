import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  LogOut,
  Package2,
  UserRound,
  Users,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '~/shared/components/ui/sidebar';
import { Separator } from '~/shared/components/ui/separator';
import { Button } from '~/shared/components/ui/button';
import { useIdentity } from './session';
import { IdentityError } from './api';

function AccountSidebar() {
  const { user, session } = useIdentity();
  const { setOpenMobile } = useSidebar();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const items = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/profile', label: 'My profile', icon: UserRound },
    ...(user!.roles.includes('Admin')
      ? [{ to: '/admin/users', label: 'User administration', icon: Users }]
      : []),
  ];
  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link to="/dashboard" onClick={() => setOpenMobile(false)}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Package2 className="size-5" aria-hidden="true" />
                </span>
                <span className="text-lg font-semibold tracking-tight">
                  SwiftDrop
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label="Workspace navigation">
              <SidebarMenu>
                {items.map(({ to, label, icon: Icon }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton asChild isActive={pathname === to}>
                      <Link
                        to={to}
                        aria-current={pathname === to ? 'page' : undefined}
                        onClick={() => setOpenMobile(false)}
                      >
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-4">
        <div className="min-w-0 rounded-lg border bg-background p-3">
          <p className="truncate text-sm font-medium">{user!.fullName}</p>
          <p
            className="truncate text-xs text-muted-foreground"
            title={user!.email}
          >
            {user!.email}
          </p>
        </div>
        <Button
          variant="ghost"
          className="justify-start"
          disabled={signingOut}
          onClick={() => {
            setSigningOut(true);
            void session
              .logout()
              .then(() => {
                window.google?.accounts.id.disableAutoSelect();
                return navigate('/login', { replace: true });
              })
              .catch((cause: unknown) =>
                navigate('/login', {
                  replace: true,
                  state: {
                    logoutError:
                      cause instanceof IdentityError
                        ? cause.message
                        : 'Server logout could not be confirmed. You have been signed out on this page.',
                  },
                }),
              );
          }}
        >
          <LogOut aria-hidden="true" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

// dashboard-01's sidebar/inset composition, with all demo content removed.
export function DashboardShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const title =
    pathname === '/profile'
      ? 'Account'
      : pathname.startsWith('/admin/')
        ? 'Administration'
        : 'Dashboard';
  return (
    <SidebarProvider
      style={
        {
          '--sidebar-width': '17rem',
          '--header-height': '3.5rem',
        } as React.CSSProperties
      }
    >
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AccountSidebar />
      <SidebarInset className="min-w-0">
        <header className="flex h-(--header-height) shrink-0 items-center gap-3 border-b px-4 lg:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="!h-4" />
          {pathname === '/dashboard' ? (
            <h1 className="text-sm font-medium">{title}</h1>
          ) : (
            <p className="text-sm font-medium">{title}</p>
          )}
        </header>
        <div
          id="main-content"
          tabIndex={-1}
          className="flex min-w-0 flex-1 flex-col gap-6 p-4 outline-none lg:p-6"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
