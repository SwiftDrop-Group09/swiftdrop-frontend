import type { ParcelStatus } from '~/features/customer-tracking/contracts';
const beforeTransitShades = [
  'bg-amber-50 dark:bg-amber-950/60',
  'bg-amber-100/60 dark:bg-amber-950/75',
  'bg-amber-100 dark:bg-amber-950',
  'bg-amber-200 dark:bg-amber-900/70',
];
const onRoadShades = [
  'bg-sky-50 dark:bg-sky-950/60',
  'bg-sky-100/60 dark:bg-sky-950/75',
  'bg-sky-100 dark:bg-sky-950',
  'bg-sky-200 dark:bg-sky-900/70',
];
const deliveredShades = [
  'bg-emerald-50 dark:bg-emerald-950/60',
  'bg-emerald-100/60 dark:bg-emerald-950/75',
  'bg-emerald-100 dark:bg-emerald-950',
  'bg-emerald-200 dark:bg-emerald-900/70',
];
const problemShades = [
  'bg-destructive/[0.025]',
  'bg-destructive/5',
  'bg-destructive/[0.075]',
  'bg-destructive/10',
];
export const statusShades: Record<ParcelStatus, string[]> = {
  Created: beforeTransitShades,
  Assigned: beforeTransitShades,
  PickedUp: beforeTransitShades,
  InTransit: onRoadShades,
  OutForDelivery: onRoadShades,
  Delivered: deliveredShades,
  Failed: problemShades,
  Cancelled: problemShades,
};

type Theme = { light: string; dark: string };
const mix = (color: string, opacity: number) =>
  `color-mix(in oklab, ${color} ${opacity}%, transparent)`;
function familyColors(family: string): Theme[] {
  const color = (shade: number) => `var(--color-${family}-${shade})`;
  return [
    { light: color(50), dark: mix(color(950), 60) },
    { light: mix(color(100), 60), dark: mix(color(950), 75) },
    { light: color(100), dark: color(950) },
    { light: color(200), dark: mix(color(900), 70) },
  ];
}
const amber = familyColors('amber'),
  sky = familyColors('sky'),
  emerald = familyColors('emerald');
const red = [2.5, 5, 7.5, 10].map((opacity) => ({
  light: mix('var(--destructive)', opacity),
  dark: mix('var(--destructive)', opacity),
}));
const themes: Record<ParcelStatus, Theme[]> = {
  Created: amber,
  Assigned: amber,
  PickedUp: amber,
  InTransit: sky,
  OutForDelivery: sky,
  Delivered: emerald,
  Failed: red,
  Cancelled: red,
};
export function statusShadeTheme(status: ParcelStatus, shade: number): Theme {
  return shade === 0
    ? { light: mix('var(--muted)', 30), dark: mix('var(--muted)', 30) }
    : themes[status][shade - 1]!;
}
