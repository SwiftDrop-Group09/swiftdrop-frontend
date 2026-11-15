/** Public failure categories. Internal Courier notes are a separate, private field. */
const labels: Record<string, string> = {
  RecipientUnavailable: 'Recipient unavailable',
  AddressUnreachable: 'Address unreachable',
  Damaged: 'Parcel damaged',
  Other: 'Delivery could not be completed',
};
export function deliveryFailureLabel(reason: string | null | undefined) {
  return reason
    ? (labels[reason] ?? reason)
    : 'Failure reason is not available yet';
}
