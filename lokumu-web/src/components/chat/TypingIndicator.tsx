import { ChatAvatar } from './ChatAvatar';

export function TypingIndicator() {
  return (
    <>
      <ChatAvatar role="assistant" />
      <div className="flex items-center gap-1.5 py-2">
        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.2s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.1s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" />
      </div>
    </>
  );
}
