import { BarChart3, DollarSign, MapPin, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Button } from '~/shared/components/ui/button';

const links = [
  { label: 'User Management', href: '/admin/users', icon: Users },
  { label: 'Delivery Zones', href: '/admin/zones', icon: MapPin },
  { label: 'Pricing Configuration', href: '/admin/pricing', icon: DollarSign },
  { label: 'Delivery Reports', href: '/admin/reports', icon: BarChart3 },
];

export function AdminNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="mb-6 flex flex-wrap items-center gap-2 border-b pb-3"
      aria-label="Admin Navigation"
    >
      {links.map(({ label, href, icon: Icon }) => {
        const active =
          pathname === href ||
          (href !== '/admin/users' && pathname.startsWith(`${href}/`));

        return (
          <Button
            key={href}
            asChild
            variant={active ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
          >
            <Link to={href} aria-current={active ? 'page' : undefined}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
