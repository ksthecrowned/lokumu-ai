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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isTyping]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  const waitingForReply =
    isTyping && (!lastAssistant?.content.trim() || lastAssistant.content === 'Lokumu prepare la reponse...');

  return (
    <div className="space-y-5 pb-2">
      {messages.map((message) => {
        const displayContent =
          message.content.trim() ||
          (message.role === 'assistant' && isTyping
            ? 'Lokumu prepare la reponse...'
            : '');

        return (
          <MessageBubble
            key={message.id}
            role={message.role}
            content={displayContent}
            sources={message.sources}
            correctionSlot={message.correctionSlot}
          />
        );
      })}
      {waitingForReply ? (
        <div className="flex justify-start pl-1">
          <TypingIndicator />
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}
