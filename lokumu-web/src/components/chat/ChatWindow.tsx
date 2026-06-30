import { useEffect, useRef, type ReactNode } from 'react';
import { MessageBubble } from './MessageBubble';
import { SourceItem } from './SourceCitation';
import { TypingIndicator } from './TypingIndicator';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  correctionSlot?: ReactNode;
};

type ChatWindowProps = {
  messages: ChatMessage[];
  isTyping: boolean;
};

export function ChatWindow({ messages, isTyping }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const lastMessage = messages[messages.length - 1];
  const streamingAssistant =
    isTyping && lastMessage?.role === 'assistant' && lastMessage.content.trim().length > 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isTyping]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const waitingForReply =
    isTyping && !lastAssistant?.content.trim();

  return (
    <div className="mx-auto w-full max-w-3xl px-3 pb-4 sm:px-4">
      {messages.map((message, index) => {
        const isLast = index === messages.length - 1;
        const displayContent =
          message.content.trim() ||
          (message.role === 'assistant' && isTyping && isLast ? '' : '');

        if (!displayContent && message.role === 'assistant' && !isLast) {
          return null;
        }

        if (!displayContent && waitingForReply && isLast) {
          return (
            <div key={message.id} className="flex gap-3 py-3">
              <TypingIndicator />
            </div>
          );
        }

        if (!displayContent) return null;

        return (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={displayContent}
            sources={message.sources}
            correctionSlot={message.correctionSlot}
            isStreaming={streamingAssistant && isLast}
          />
        );
      })}
      {waitingForReply && lastMessage?.role !== 'assistant' ? (
        <div className="flex gap-3 py-3">
          <TypingIndicator />
        </div>
      ) : null}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
}
