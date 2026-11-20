import { LandingPage } from '~/features/landing/landing-page';

export const meta = () => [
  { title: 'SwiftDrop | Fast, Reliable Urban Parcel Delivery' },
  {
    name: 'description',
    content:
      'SwiftDrop connects customers, local merchants, couriers, and dispatchers with instant parcel booking, real-time public tracking, and transparent zone pricing.',
  },
];

export default function Index() {
  return <LandingPage />;
}
