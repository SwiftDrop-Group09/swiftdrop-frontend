import { Link, useLocation } from 'react-router';
import { Users, MapPin, DollarSign, BarChart3 } from 'lucide-react';
import { Button } from '~/shared/components/ui/button';

export function AdminNav() {
  const location = useLocation();
  const currentPath = location.pathname;

  const links = [
    { label: 'User Management', href: '/admin/users', icon: Users },
    { label: 'Delivery Zones', href: '/admin/zones', icon: MapPin },
    { label: 'Pricing Configuration', href: '/admin/pricing', icon: DollarSign },
    { label: 'Delivery Reports', href: '/admin/reports', icon: BarChart3 },
  ];

  return (
    <nav className="mb-6 flex flex-wrap items-center gap-2 border-b pb-3" aria-label="Admin Navigation">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive =
          currentPath === link.href ||
          (link.href !== '/admin/users' && currentPath.startsWith(link.href));
        return (
          <Button
            key={link.href}
            asChild
            variant={isActive ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
          >
            <Link to={link.href}>
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
