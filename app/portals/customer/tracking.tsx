import { CustomerTrackingPage } from '~/features/customer-tracking/tracking-page';
export {
  useLiveParcelTracking,
  useCustomerParcel,
} from '~/features/customer-tracking/hooks';
export { subscribeParcelEvents } from '~/features/customer-tracking/api';

export default function CustomerTrackingRoute() {
  return <CustomerTrackingPage />;
}
