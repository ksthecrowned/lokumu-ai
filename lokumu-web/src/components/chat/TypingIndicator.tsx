export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <span className="h-2 w-2 animate-bounce rounded-full bg-lokumu-primary [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-lokumu-primary [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-lokumu-primary" />
      <span className="ml-1">Lokumu est en train d&apos;ecrire...</span>
    </div>
  );
}
