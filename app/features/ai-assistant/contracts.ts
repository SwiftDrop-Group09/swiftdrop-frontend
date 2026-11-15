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

export interface AssistantCards {
  tracking?: TrackingCardData | null;
  parcelList?: ParcelListCardData | null;
  quote?: QuoteCardData | null;
  zones?: ZonesCardData | null;
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
