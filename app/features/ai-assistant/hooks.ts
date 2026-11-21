import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useIdentity } from '~/features/identity/session';
import { fetchMcpTools, sendAssistantMessage } from './api';
import type { ChatMessage } from './contracts';

const STORAGE_KEY = 'swiftdrop_assistant_history_v1';

function loadStoredMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredMessages(messages: ChatMessage[]) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Ignore storage quota errors
  }
}

export function useAssistantChat() {
  const { session, user } = useIdentity();
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredMessages);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    saveStoredMessages(messages);
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isSending) return;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);

      try {
        const history = messages
          .filter((m) => m.id !== 'welcome-msg')
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));

        const response = await sendAssistantMessage(
          {
            message: trimmed,
            history,
          },
          session?.authenticatedRequest ?? null,
        );

        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role: 'assistant',
          content: response.reply,
          timestamp: new Date().toISOString(),
          toolCalls: response.toolCalls,
          cards: response.cards ?? undefined,
          guardrail: response.guardrail ?? undefined,
          suggestedPrompts: response.suggestedPrompts ?? undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Sorry, I encountered an unexpected error connecting to the assistant. Please try again.';

        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **Error**: ${errorMessage}`,
          timestamp: new Date().toISOString(),
          isError: true,
          suggestedPrompts: [
            'Where is my parcel?',
            'How much to send 2 kg to Kandy?',
          ],
        };

        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, messages, session],
  );

  return {
    messages,
    isSending,
    sendMessage,
    clearChat,
    isAuthenticated: Boolean(user),
  };
}

export function useMcpTools() {
  return useQuery({
    queryKey: ['mcp-tools-catalog'],
    queryFn: () => fetchMcpTools(),
    staleTime: 5 * 60 * 1000,
  });
}
