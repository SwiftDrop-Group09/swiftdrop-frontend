import { CustomerReceiptPage } from '~/features/customer-tracking/receipt-page';
export { downloadReceiptPdf } from '~/features/customer-tracking/api';
export {
  useDownloadReceiptPdf,
  useParcelReceipt,
} from '~/features/customer-tracking/hooks';

export default function CustomerReceiptRoute() {
  return <CustomerReceiptPage />;
}
