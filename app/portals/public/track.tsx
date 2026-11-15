import { PublicTrackingPage } from '~/features/customer-tracking/public-tracking-page';
export { usePublicTracking } from '~/features/customer-tracking/hooks';
export { getPublicTracking } from '~/features/customer-tracking/api';

export default function PublicTrackRoute() {
  return <PublicTrackingPage />;
}
