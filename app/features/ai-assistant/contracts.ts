export type AssistantRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: AssistantRole;
  content: string;
  timestamp: string;
  toolCalls?: AssistantToolCallTrace[];
  cards?: AssistantCards;
  guardrail?: GuardrailResult;
  suggestedPrompts?: string[];
  isError?: boolean;
}

export interface AssistantChatRequest {
  message: string;
  conversationId?: string;
  history?: Array<{ role: string; content: string }>;
}

export interface AssistantToolCallTrace {
  toolName: string;
  arguments: unknown;
  status: 'success' | 'error' | 'running';
  durationMs: number;
  summary: string;
}

export interface GuardrailResult {
  blocked: boolean;
  reason: string;
}

export interface MilestoneStep {
  status: string;
  label: string;
  timestamp?: string | null;
  completed: boolean;
  current: boolean;
}

export interface TrackingCardData {
  trackingNumber: string;
  status: string;
  originCity: string;
  destinationCity: string;
  lastUpdatedAt: string;
  steps: MilestoneStep[];
  canViewReceipt: boolean;
  parcelId?: string | null;
  isPublic?: boolean;
}

export interface ParcelSummaryItem {
  trackingNumber: string;
  status: string;
  route: string;
  weightKg: number;
  size: string;
  createdAt: string;
  parcelId?: string | null;
}

export interface ParcelListCardData {
  totalCount: number;
  parcels: ParcelSummaryItem[];
}

export interface QuoteCardData {
  quoteId?: string | null;
  total: number;
  currency: string;
  pricingVersion: string;
  expiresAt?: string | null;
  weightKg: number;
  size: string;
  pickupCity: string;
  deliveryCity: string;
  bookingDeepLink: string;
}

export interface ZoneCoverageItem {
  zoneId: string;
  name: string;
  cities: string[];
  active: boolean;
}

export interface ZonesCardData {
  zones: ZoneCoverageItem[];
  supportedCities: string[];
}

// -------------------------------------------------------------
// Role-Specific Card Interfaces
// -------------------------------------------------------------

// Courier Cards
export interface CourierAssignmentItem {
  trackingNumber: string;
  status: string;
  recipientName: string;
  recipientPhone: string;
  dropoffAddress: string;
  dropoffCity: string;
  weightKg: number;
  externalOrderId?: string | null;
}

export interface CourierAssignmentsCardData {
  totalCount: number;
  serviceDate: string;
  assignments: CourierAssignmentItem[];
}

export interface CourierWorkSummaryCardData {
  serviceDate: string;
  assigned: number;
  pickedUp: number;
  inTransit: number;
  outForDelivery: number;
  delivered: number;
  failed: number;
  active: number;
  completed: number;
  overdueCount: number;
}

export interface CourierDutyCardData {
  onDuty: boolean;
  vehicleType?: string | null;
  vehicleNumber?: string | null;
  maxWeightKg: number;
  statusMessage: string;
}

export interface CourierProtocolCardData {
  title: string;
  steps: string[];
  exceptionGuidelines: string;
}

// Dispatcher Cards
export interface UnassignedParcelItem {
  parcelId: string;
  trackingNumber: string;
  pickupCity: string;
  deliveryCity: string;
  weightKg: number;
  size: string;
  createdAt: string;
}

export interface DispatcherQueueCardData {
  totalUnassigned: number;
  parcels: UnassignedParcelItem[];
}

export interface CourierWorkloadItem {
  courierId: string;
  courierCode: string;
  onDuty: boolean;
  activeCount: number;
  capacity: number;
  vehicleType: string;
  maxWeightKg: number;
}

export interface CourierWorkloadCardData {
  totalCouriers: number;
  activeCouriersOnDuty: number;
  couriers: CourierWorkloadItem[];
}

export interface ZoneDispatchItem {
  zoneName: string;
  pendingPickups: number;
  inTransit: number;
  couriersCount: number;
}

export interface ZoneDispatchCardData {
  zones: ZoneDispatchItem[];
}

// Merchant Cards
export interface MerchantOrderItem {
  trackingNumber: string;
  externalOrderId?: string | null;
  status: string;
  recipientCity: string;
  weightKg: number;
  priceLkr?: number | null;
  createdAt: string;
}

export interface MerchantOrdersCardData {
  totalOrders: number;
  orders: MerchantOrderItem[];
}

export interface MerchantIntegrationCardData {
  apiBaseUrl: string;
  endpoint: string;
  webhookEvents: string[];
  signatureAlgorithm: string;
  documentationUrl: string;
}

// Admin Cards
export interface AdminReportMetricItem {
  date: string;
  delivered: number;
  failed: number;
  cancelled: number;
}

export interface AdminReportCardData {
  from: string;
  to: string;
  delivered: number;
  failed: number;
  cancelled: number;
  totalTerminal: number;
  successRate: number;
  failureRate: number;
  dailyMetrics: AdminReportMetricItem[];
}

export interface AdminTariffItem {
  zoneName: string;
  size: string;
  baseRate: number;
  perKgRate: number;
  currency: string;
  isActive: boolean;
  pricingVersion: string;
}

export interface AdminTariffsCardData {
  totalTiers: number;
  tiers: AdminTariffItem[];
}

export interface AdminOverviewCardData {
  totalParcelsToday: number;
  unassignedParcels: number;
  activeCouriersOnDuty: number;
  activeZonesCount: number;
  todaySuccessRate: number;
}

export interface AssistantCards {
  tracking?: TrackingCardData | null;
  parcelList?: ParcelListCardData | null;
  quote?: QuoteCardData | null;
  zones?: ZonesCardData | null;
  courierAssignments?: CourierAssignmentsCardData | null;
  courierWorkSummary?: CourierWorkSummaryCardData | null;
  courierDuty?: CourierDutyCardData | null;
  courierProtocol?: CourierProtocolCardData | null;
  dispatcherQueue?: DispatcherQueueCardData | null;
  courierWorkload?: CourierWorkloadCardData | null;
  zoneDispatch?: ZoneDispatchCardData | null;
  merchantOrders?: MerchantOrdersCardData | null;
  merchantIntegration?: MerchantIntegrationCardData | null;
  adminReport?: AdminReportCardData | null;
  adminTariffs?: AdminTariffsCardData | null;
  adminOverview?: AdminOverviewCardData | null;
}

export interface AssistantChatResponse {
  reply: string;
  mode: string;
  toolCalls: AssistantToolCallTrace[];
  cards?: AssistantCards | null;
  suggestedPrompts?: string[] | null;
  guardrail?: GuardrailResult | null;
}

// -------------------------------------------------------------
// MCP Catalog Contracts
// -------------------------------------------------------------

export interface McpToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
}

export interface McpToolInputSchema {
  type: string;
  required?: string[];
  properties: Record<string, McpToolPropertySchema>;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: McpToolInputSchema;
}

export interface McpCatalogResponse {
  tools: McpToolDefinition[];
}
