import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  CornerDownLeft,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
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
import { useAssistantChat } from './hooks';

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, isSending, sendMessage, clearChat, isAuthenticated } =
    useAssistantChat();

  // Keyboard shortcut: Alt+A or Ctrl+K / Cmd+K to toggle assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && e.key.toLowerCase() === 'a') ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')
      ) {
        // Prevent default if not typing in a form input already
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

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex items-center gap-2 rounded-full px-4 py-3 shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 bg-primary text-primary-foreground font-semibold"
          aria-label="Open AI Delivery Assistant (Alt+A)"
        >
          <div className="relative flex items-center justify-center">
            <Bot className="h-5 w-5" />
            <Sparkles className="absolute -top-1 -right-1 h-3 w-3 text-amber-300 animate-pulse" />
          </div>
          <span className="hidden sm:inline">SwiftDrop AI</span>
          <kbd className="hidden lg:inline-flex items-center rounded border border-primary-foreground/30 bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] font-mono opacity-80">
            Alt+A
          </kbd>
        </Button>
      </div>

      {/* Slide-over Drawer / Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col p-0 sm:max-w-lg md:max-w-xl"
        >
          {/* Header */}
          <SheetHeader className="border-b px-4 py-3.5 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <SheetTitle className="text-base font-bold leading-none">
                    AI Delivery Assistant
                  </SheetTitle>
                  <SheetDescription className="mt-1 flex items-center gap-1.5 text-xs">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span>MCP Tool Integration Active</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground font-mono">
                      {isAuthenticated ? 'Customer Scope' : 'Public Guest'}
                    </span>
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
            {messages.map((msg) => (
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
                      : 'bg-muted/70 text-foreground border rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">
                    {msg.content}
                  </div>
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

                {/* Suggested Prompts */}
                {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {msg.suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => handlePromptClick(prompt)}
                        disabled={isSending}
                        className="rounded-full border border-primary/30 bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* In-Flight Tool Calling State */}
            {isSending && (
              <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="font-medium">
                  Calling backend MCP tools & generating grounded response...
                </span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <div className="border-t bg-background p-3 sm:p-4">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask e.g. 'Where is my parcel?' or 'Fee to Kandy'..."
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
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>Read & Quote Only • Zero Autonomous Writes</span>
              <span className="font-mono">JSON-RPC 2.0 / MCP</span>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
