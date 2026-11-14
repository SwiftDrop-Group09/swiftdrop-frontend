import { OrderHistoryPage } from '~/features/customer-tracking/history-page';
export { downloadReceiptPdf } from '~/features/customer-tracking/api';
export {
  useDownloadReceiptPdf,
  useCustomerParcels,
} from '~/features/customer-tracking/hooks';

export default function CustomerHistoryRoute() {
  return <OrderHistoryPage />;
}
