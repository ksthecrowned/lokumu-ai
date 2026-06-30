import type { ReactNode } from 'react';
import { ChatAvatar } from './ChatAvatar';
import { SourceCitation, SourceItem } from './SourceCitation';

type MessageBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  correctionSlot?: ReactNode;
  isStreaming?: boolean;
};

export function MessageBubble({
  role,
  content,
  sources = [],
  correctionSlot,
  isStreaming = false,
}: MessageBubbleProps) {
  const isUser = role === 'user';

  if (!content.trim()) {
    return null;
  }

  if (isUser) {
    return (
      <div className="group flex justify-end gap-3 py-2">
        <div className="max-w-[min(85%,42rem)] rounded-[22px] bg-[#2f2f2f] px-4 py-2.5 text-[15px] leading-relaxed text-zinc-100">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
        <ChatAvatar role="user" />
      </div>
    );
  }

  return (
    <div className="group flex gap-3 py-3">
      <ChatAvatar role="assistant" />
      <div className="min-w-0 flex-1 max-w-[min(100%,46rem)]">
        <div className="text-[15px] leading-relaxed text-zinc-100">
          <p className="whitespace-pre-wrap">{content}</p>
          {isStreaming ? (
            <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse bg-zinc-400 align-text-bottom" />
          ) : null}
        </div>
        {!isUser && sources.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {sources.map((source) => (
              <SourceCitation key={source.id} source={source} />
            ))}
          </div>
        ) : null}
        {!isUser && correctionSlot ? (
          <div className="mt-3 opacity-80 transition group-hover:opacity-100">
            {correctionSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
}
