import { BrandLogo } from '~/shared/components/brand-logo';
import { ThemeMenu } from '~/shared/components/theme-menu';
import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ChevronsUpDown, LogOut, UserRound } from 'lucide-react';
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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '~/shared/components/ui/sidebar';
import { Separator } from '~/shared/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '~/shared/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/shared/components/ui/dropdown-menu';
import { useIdentity } from './session';
import { IdentityError } from './api';
import { getWorkspaceNavigation } from './workspace-navigation';

function AccountSidebar() {
  const { user, session } = useIdentity();
  const { setOpenMobile, isMobile } = useSidebar();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const groups = getWorkspaceNavigation(user!.roles);
  return (
    <Sidebar variant="inset" collapsible="offcanvas">
      <SidebarHeader className="p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link to="/dashboard" onClick={() => setOpenMobile(false)}>
                <BrandLogo />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.id}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <nav aria-label={`${group.label} navigation`}>
                <SidebarMenu>
                  {group.items.map(({ to, label, icon: Icon }) => {
                    const active =
                      to === `${pathname}${hash}` ||
                      (to === '/courier' &&
                        pathname.startsWith('/courier/parcels/'));
                    return (
                      <SidebarMenuItem key={label}>
                        {to ? (
                          <SidebarMenuButton asChild isActive={active}>
                            <Link
                              to={to}
                              aria-current={active ? 'page' : undefined}
                              onClick={() => setOpenMobile(false)}
                            >
                              <Icon aria-hidden="true" />
                              <span>{label}</span>
                            </Link>
                          </SidebarMenuButton>
                        ) : (
                          <>
                            <SidebarMenuButton
                              disabled
                              className="pr-12"
                              aria-describedby="navigation-availability"
                            >
                              <Icon aria-hidden="true" />
                              <span>{label}</span>
                            </SidebarMenuButton>
                            <SidebarMenuBadge
                              aria-hidden="true"
                              className="text-muted-foreground"
                            >
                              Soon
                            </SidebarMenuBadge>
                          </>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </nav>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        <p
          id="navigation-availability"
          className="px-4 pb-3 text-xs leading-relaxed text-muted-foreground"
        >
          Items marked Soon will be available in a future update.
        </p>
      </SidebarContent>
      <SidebarFooter className="mt-auto p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  aria-label="Open account menu"
                  disabled={signingOut}
                >
                  <UserRound aria-hidden="true" />
                  <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user!.fullName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {user!.email}
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-auto" aria-hidden="true" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? 'top' : 'right'}
                align="end"
                sideOffset={8}
                className="w-64 max-w-[calc(100vw-2rem)]"
              >
                <DropdownMenuLabel className="grid gap-1">
                  <span className="truncate">{user!.fullName}</span>
                  <span className="truncate text-xs font-normal text-muted-foreground">
                    {user!.roles.join(', ') || 'Account'}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" onClick={() => setOpenMobile(false)}>
                    <UserRound aria-hidden="true" />
                    My profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <ThemeMenu />
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={signingOut}
                  onSelect={() => {
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
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

// dashboard-01's sidebar/inset composition, with all demo content removed.
export function DashboardShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const adminPage =
    {
      '/admin/users': 'Users',
      '/admin/audit': 'Audit log',
      '/admin/merchants': 'Merchant approvals',
      '/admin/zones': 'Delivery zones',
      '/admin/pricing': 'Pricing tiers',
      '/admin/reports': 'Delivery reports',
      '/dispatch/zones': 'Zone summary',
      '/dispatch/workload': 'Courier workload',
      '/dispatch/parcels': 'Parcel tracking & history',
      '/401': 'Sign in required',
      '/403': 'Access denied',
      '/customer/book': 'Book a delivery',
      '/customer/tracking': 'Track a parcel',
      '/customer/history': 'Delivery history',
      '/customer/receipts': 'Receipts',
      '/courier': 'Assigned deliveries',
      '/courier/history': 'Delivery history',
      '/merchant': 'Business and API keys',
      '/merchant/webhooks': 'Webhooks',
      '/profile': 'My profile',
    }[pathname] ??
    (/^\/(customer|dispatch)\/parcels\/[^/]+(?:\/receipt)?\/?$/.test(pathname)
      ? pathname.endsWith('/receipt')
        ? 'Parcel receipt'
        : 'Parcel tracking'
      : undefined);
  const sectionName = pathname.startsWith('/admin/')
    ? 'Administration'
    : pathname.startsWith('/dispatch/')
      ? 'Dispatch'
      : pathname.startsWith('/customer/')
        ? 'Customer'
        : pathname.startsWith('/courier')
          ? 'Courier'
          : pathname.startsWith('/merchant')
            ? 'Merchant'
            : 'Account';
  const title =
    pathname === '/profile'
      ? 'Account'
      : pathname.startsWith('/admin/')
        ? 'Administration'
        : pathname === '/customer/book'
          ? 'Book a delivery'
          : pathname.startsWith('/courier')
            ? 'Courier deliveries'
            : 'Dashboard';
  return (
    <SidebarProvider className="[--sidebar-width:17rem] [--header-height:3.5rem]">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AccountSidebar />
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-3 border-b bg-background px-4 lg:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="!h-4" />
          {adminPage ? (
            <Breadcrumb>
              <BreadcrumbList className="flex-nowrap">
                <BreadcrumbItem className="hidden sm:inline-flex">
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem className="hidden sm:inline-flex">
                  {sectionName}
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>{adminPage}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          ) : pathname === '/dashboard' ? (
            <p className="text-sm font-medium">{title}</p>
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
