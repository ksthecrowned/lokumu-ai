import type { ReactNode } from 'react';
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
  return (
    <div className="lokumu-scrollbar h-[52vh] space-y-4 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          role={message.role}
          content={message.content}
          sources={message.sources}
          correctionSlot={message.correctionSlot}
        />
      ))}
      {isTyping ? (
        <div className="flex justify-start">
          <TypingIndicator />
        </div>
      ) : null}
    </div>
  );
}
