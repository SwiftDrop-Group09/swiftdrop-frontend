export const PARCEL_STATUSES = [
  'Created',
  'Assigned',
  'PickedUp',
  'InTransit',
  'OutForDelivery',
  'Delivered',
  'Failed',
  'Cancelled',
] as const;

export type ParcelStatus = (typeof PARCEL_STATUSES)[number];

export const PARCEL_STATUS_LABELS: Record<ParcelStatus, string> = {
  Created: 'Booked',
  Assigned: 'Assigned',
  PickedUp: 'Collected',
  InTransit: 'In transit',
  OutForDelivery: 'Out for delivery',
  Delivered: 'Delivered',
  Failed: 'Delivery unsuccessful',
  Cancelled: 'Cancelled',
};

export type NormalizedAddress = {
  street: string;
  city: string;
  postalCode: string;
  zoneId: string;
};

export type NormalizedRecipient = {
  name: string;
  phoneNumber: string;
};

export type PackageDetails = {
  weightKg: number;
  size: string;
};

export type PriceSnapshotSummary = {
  total: number;
  currency: string;
  pricingVersion: string;
};

export type CustomerParcelListItem = {
  id: string;
  trackingNumber: string;
  status: ParcelStatus;
  version: number;
  priceSnapshot: PriceSnapshotSummary;
  createdAt: string;
  updatedAt: string;
  pickupCity: string;
  deliveryCity: string;
  recipientName: string;
  packageDetails: PackageDetails;
  hasProof: boolean;
};

export type CustomerParcelPage = {
  items: CustomerParcelListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
};

export type CustomerParcelQuery = {
  status?: ParcelStatus;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ParcelAssignment = {
  status: string;
  serviceDate: string;
  assignedAt: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
};

export type ParcelHistoryEntry = {
  fromStatus: ParcelStatus | null;
  toStatus: ParcelStatus;
  changeReason: string | null;
  deliveryNote: string | null;
  timestamp: string;
};

export type ParcelDetail = {
  id: string;
  trackingNumber: string;
  status: ParcelStatus;
  version: number;
  priceSnapshot: PriceSnapshotSummary;
  createdAt: string;
  pickupAddress: NormalizedAddress;
  deliveryAddress: NormalizedAddress;
  packageDetails: PackageDetails;
  recipient: NormalizedRecipient;
  assignment: ParcelAssignment | null;
  history: ParcelHistoryEntry[];
};

export type PublicTimelineEntry = {
  status: ParcelStatus;
  timestamp: string;
  label: string;
};

export type PublicTrackingSummary = {
  trackingNumber: string;
  status: ParcelStatus;
  originCity: string;
  destinationCity: string;
  lastUpdatedAt: string;
  timeline: PublicTimelineEntry[];
};

export type ParcelEventSnapshot = {
  id: string;
  status: ParcelStatus;
  version: number;
  lastUpdatedAt: string;
};

export type ParcelEventsResponse = {
  id: string;
  trackingNumber: string;
  status: ParcelStatus;
  version: number;
  lastUpdatedAt: string;
  events: ParcelHistoryEntry[];
};

export type ParcelReceipt = {
  receiptNumber: string;
  parcelId: string;
  trackingNumber: string;
  status: ParcelStatus;
  createdAt: string;
  deliveredAt: string | null;
  pickupAddress: NormalizedAddress;
  deliveryAddress: NormalizedAddress;
  recipient: NormalizedRecipient;
  packageDetails: PackageDetails;
  baseFee: number;
  weightFee: number;
  total: number;
  currency: string;
  pricingVersion: string;
  calculatedAt: string;
};

export type ProofOfDeliveryInfo = {
  parcelId: string;
  trackingNumber: string;
  proofType: string;
  recipientName: string;
  uploadedAt: string;
  hasImage: boolean;
};

