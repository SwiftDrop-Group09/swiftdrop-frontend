import {
  ChartNoAxesCombined,
  ClipboardList,
  FileChartColumn,
  History,
  KeyRound,
  LayoutDashboard,
  Map,
  MapPin,
  PackagePlus,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Truck,
  UserRound,
  Users,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import type { Profile } from './contracts';

type Role = Profile['roles'][number];
type NavigationItem = {
  label: string;
  icon: LucideIcon;
  // Only implemented screens have a destination. Planned items remain disabled.
  to?: string;
};
type NavigationGroup = {
  id: string;
  label: string;
  items: readonly NavigationItem[];
  roles?: readonly Role[];
};

// SRS sections 3.1-3.5, use-case specifications and security/authorization.md.
// Detailed requirement mappings and availability: docs/workspace-navigation.md.
const navigation: readonly NavigationGroup[] = [
  {
    id: 'workspace',
    label: 'Workspace',
    items: [
      { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
      { label: 'My profile', icon: UserRound, to: '/profile' },
      // Onboarding accepts any authenticated applicant, before a Merchant role.
      { label: 'Business registration', icon: Store, to: '/merchant' },
    ],
  },
  {
    id: 'customer',
    label: 'Customer',
    roles: ['Customer'],
    items: [
      { label: 'Book a delivery', icon: PackagePlus, to: '/customer/book' },
      { label: 'Track a parcel', icon: MapPin },
      { label: 'Delivery history', icon: History },
      { label: 'Receipts', icon: ReceiptText },
    ],
  },
  {
    id: 'courier',
    label: 'Courier',
    roles: ['Courier'],
    items: [
      // Status, proof and failure actions belong to an assigned parcel's detail.
      { label: 'Assigned deliveries', icon: Truck, to: '/courier' },
      { label: 'Delivery history', icon: History, to: '/courier/history' },
    ],
  },
  {
    id: 'merchant',
    label: 'Merchant',
    roles: ['Merchant'],
    items: [
      { label: 'Business overview', icon: ChartNoAxesCombined },
      { label: 'Orders', icon: ClipboardList },
      { label: 'API keys', icon: KeyRound, to: '/merchant' },
      { label: 'Webhooks', icon: Webhook, to: '/merchant/webhooks' },
    ],
  },
  {
    id: 'dispatch',
    label: 'Dispatch',
    // Authorization explicitly permits Admin assignment/reassignment as well.
    roles: ['Dispatcher', 'Admin'],
    items: [
      { label: 'Unassigned parcels', icon: ClipboardList },
      { label: 'Courier workload', icon: Users },
      { label: 'Zone summary', icon: Map },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    roles: ['Admin'],
    items: [
      { label: 'User administration', icon: Users, to: '/admin/users' },
      {
        label: 'Merchant approvals',
        icon: ShieldCheck,
        to: '/admin/merchants',
      },
      { label: 'Delivery zones', icon: Map },
      { label: 'Pricing tiers', icon: SlidersHorizontal },
      { label: 'Delivery reports', icon: FileChartColumn },
      {
        label: 'Audit logs',
        icon: ScrollText,
        to: '/admin/users#identity-audit',
      },
    ],
  },
];

export function getWorkspaceNavigation(assignedRoles: readonly Role[]) {
  return navigation.filter(
    (group) =>
      !group.roles || group.roles.some((role) => assignedRoles.includes(role)),
  );
}
