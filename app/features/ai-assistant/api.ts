import type { AuthenticatedRequest } from '~/features/identity/contracts';
import type {
  AssistantChatRequest,
  AssistantChatResponse,
  McpCatalogResponse,
} from './contracts';

export class AssistantApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message = 'The delivery assistant request failed.',
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<AssistantApiError> {
  try {
    const problem = (await response.json()) as {
      code?: string;
      title?: string;
      detail?: string;
    };
    return new AssistantApiError(
      problem.code ?? 'assistant_error',
      response.status,
      problem.detail ??
        problem.title ??
        'The assistant request could not be completed.',
    );
  } catch {
    return new AssistantApiError('network_error', response.status);
  }
}

export async function sendAssistantMessage(
  payload: AssistantChatRequest,
  authenticatedRequest?: AuthenticatedRequest | null,
  apiBase = '/api',
  signal?: AbortSignal,
): Promise<AssistantChatResponse> {
  const url = `${apiBase}/v1/assistant/chat`;
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  };

  const response = authenticatedRequest
    ? await authenticatedRequest(url, init)
    : await fetch(url, init);

  if (!response.ok) {
    throw await readError(response);
  }

  return (await response.json()) as AssistantChatResponse;
}

export async function fetchMcpTools(
  apiBase = '/api',
  signal?: AbortSignal,
): Promise<McpCatalogResponse> {
  const response = await fetch(`${apiBase}/v1/mcp/tools`, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw await readError(response);
  }

  return (await response.json()) as McpCatalogResponse;
}
