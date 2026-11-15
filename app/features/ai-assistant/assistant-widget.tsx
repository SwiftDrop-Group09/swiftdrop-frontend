import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { CornerDownLeft, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { Button } from '~/shared/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '~/shared/components/ui/sheet';
import {
  ParcelListResultCard,
  QuoteResultCard,
  ToolTraceBadge,
  TrackingResultCard,
  ZonesResultCard,
} from './assistant-cards';
import { FormattedAssistantText } from './formatted-assistant-text';
import { useAssistantChat } from './hooks';

export function AssistantWidget() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isSending, sendMessage, clearChat } = useAssistantChat();

  // Hide floating launcher on the dedicated full-page assistant route
  const isDedicatedAssistantPage = location.pathname.startsWith(
    '/customer/assistant',
  );

  // Keyboard shortcut: Alt+A to toggle assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && e.key.toLowerCase() === 'a') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      ) {
        const target = e.target as HTMLElement;
        const isInput =
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
        if (!isInput || (e.altKey && e.key.toLowerCase() === 'a')) {
          e.preventDefault();
          setOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, isSending]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (isDedicatedAssistantPage) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isSending) return;
    setInputValue('');
    void sendMessage(text);
  };

  const handlePromptClick = (prompt: string) => {
    if (isSending) return;
    void sendMessage(prompt);
  };

  // Get suggested prompts from the latest message
  const latestAssistantMessage = [...messages]
    .reverse()
    .find(
      (m) =>
        m.role === 'assistant' &&
        m.suggestedPrompts &&
        m.suggestedPrompts.length > 0,
    );
  const activeSuggestedPrompts = (
    latestAssistantMessage?.suggestedPrompts ?? []
  ).slice(0, 3);

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2.5 shadow-lg text-foreground hover:bg-muted/80 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] font-medium text-sm"
          aria-label="Open Delivery Assistant (Alt+A)"
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <span>Delivery Assistant</span>
          <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
            Alt+A
          </kbd>
        </button>
      </div>

      {/* Slide-over Drawer / Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col p-0 sm:max-w-lg md:max-w-xl"
        >
          {/* Header */}
          <SheetHeader className="border-b px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold leading-none">
                    Delivery Assistant
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs text-muted-foreground">
                    Track parcels or estimate shipping rates
                  </SheetDescription>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={clearChat}
                  title="Clear chat history"
                  aria-label="Clear chat history"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </SheetHeader>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
            {messages.length === 0 ? (
              <div className="my-auto flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <p className="text-sm font-medium text-foreground">
                  How can I help you today?
                </p>
                <p className="text-xs max-w-xs">
                  Ask to track a parcel, estimate delivery rates, or view your
                  active shipments.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const hasCards = Boolean(
                  msg.cards?.tracking ||
                  msg.cards?.quote ||
                  msg.cards?.parcelList ||
                  msg.cards?.zones,
                );

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    {/* Message Bubble */}
                    <div
                      className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-xs ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-xs'
                          : 'bg-muted/40 text-foreground border border-border/60 rounded-bl-xs'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <div className="whitespace-pre-wrap break-words">
                          {msg.content}
                        </div>
                      ) : (
                        <FormattedAssistantText
                          text={msg.content}
                          hasCards={hasCards}
                        />
                      )}
                    </div>

                    {/* Tool Execution Traces */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="w-full max-w-[95%]">
                        {msg.toolCalls.map((trace, idx) => (
                          <ToolTraceBadge
                            key={`${trace.toolName}-${idx}`}
                            trace={trace}
                          />
                        ))}
                      </div>
                    )}

                    {/* Rich Result Cards */}
                    {msg.cards?.tracking && (
                      <div className="w-full max-w-[95%]">
                        <TrackingResultCard data={msg.cards.tracking} />
                      </div>
                    )}
                    {msg.cards?.quote && (
                      <div className="w-full max-w-[95%]">
                        <QuoteResultCard data={msg.cards.quote} />
                      </div>
                    )}
                    {msg.cards?.parcelList && (
                      <div className="w-full max-w-[95%]">
                        <ParcelListResultCard
                          data={msg.cards.parcelList}
                          onSelectParcel={(code) => {
                            void sendMessage(`Track parcel ${code}`);
                          }}
                        />
                      </div>
                    )}
                    {msg.cards?.zones && (
                      <div className="w-full max-w-[95%]">
                        <ZonesResultCard data={msg.cards.zones} />
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* In-Flight State */}
            {isSending && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">
                  Retrieving delivery information...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="border-t bg-background p-3 sm:p-4 space-y-2">
            {activeSuggestedPrompts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 px-1">
                {activeSuggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handlePromptClick(prompt)}
                    disabled={isSending}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask e.g. 'Where is my parcel?'..."
                disabled={isSending}
                className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                type="submit"
                size="sm"
                disabled={!inputValue.trim() || isSending}
                className="h-9 px-3 gap-1.5"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <span>Send</span>
                    <CornerDownLeft className="h-3.5 w-3.5 opacity-70" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
