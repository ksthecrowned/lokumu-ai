import type { ReactNode } from 'react';
import { SourceCitation, SourceItem } from './SourceCitation';

type MessageBubbleProps = {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceItem[];
  correctionSlot?: ReactNode;
};

export function MessageBubble({
  role,
  content,
  sources = [],
  correctionSlot,
}: MessageBubbleProps) {
  const isUser = role === 'user';
  const label = isUser ? 'Vous' : 'Lokumu';

  if (!content.trim()) {
    return null;
  }

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <span
        className={`mb-1 px-1 text-xs font-medium ${
          isUser ? 'text-lokumu-primary' : 'text-slate-500'
        }`}
      >
        {label}
      </span>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-soft ${
          isUser
            ? 'bg-lokumu-primary text-white'
            : 'border border-slate-200 bg-white text-slate-900'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
        {!isUser && sources.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source
            </p>
            {sources.map((source) => (
              <SourceCitation key={source.id} source={source} />
            ))}
          </div>
        ) : null}
        {!isUser && correctionSlot ? <div className="mt-3">{correctionSlot}</div> : null}
      </div>
    </div>
  );
}
