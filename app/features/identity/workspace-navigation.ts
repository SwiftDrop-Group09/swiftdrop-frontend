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
  roles?: readonly Role[];
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
      // Customers apply before receiving a Merchant role.
      {
        label: 'Business registration',
        icon: Store,
        to: '/merchant',
        roles: ['Customer'],
      },
    ],
  },
  {
    id: 'customer',
    label: 'Customer',
    roles: ['Customer'],
    items: [
      { label: 'Book a delivery', icon: PackagePlus, to: '/customer/book' },
      { label: 'Track a parcel', icon: MapPin, to: '/customer/tracking' },
      { label: 'Delivery history', icon: History, to: '/customer/history' },
      { label: 'Receipts', icon: ReceiptText, to: '/customer/receipts' },
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
      {
        label: 'Parcel tracking & history',
        icon: History,
        to: '/dispatch/parcels',
      },
      { label: 'Unassigned parcels', icon: ClipboardList },
      { label: 'Courier workload', icon: Users },
      { label: 'Zone summary', icon: Map, to: '/dispatch/zones' },
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
      { label: 'Delivery zones', icon: Map, to: '/admin/zones' },
      { label: 'Pricing tiers', icon: SlidersHorizontal, to: '/admin/pricing' },
      {
        label: 'Delivery reports',
        icon: FileChartColumn,
        to: '/admin/reports',
      },
      {
        label: 'Audit logs',
        icon: ScrollText,
        to: '/admin/audit',
      },
    ],
  },
];

export function getWorkspaceNavigation(assignedRoles: readonly Role[]) {
  if (assignedRoles.length !== 1) return [];
  return navigation
    .filter(
      (group) =>
        !group.roles ||
        group.roles.some((role) => assignedRoles.includes(role)),
    )
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.roles || item.roles.includes(assignedRoles[0]!),
      ),
    }));
}
