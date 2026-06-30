type ChatAvatarProps = {
  role: 'user' | 'assistant';
};

export function ChatAvatar({ role }: ChatAvatarProps) {
  if (role === 'user') {
    return (
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-semibold text-zinc-100"
        aria-hidden
      >
        V
      </div>
    );
  }

  return (
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lokumu-primary text-[11px] font-bold text-white"
      aria-hidden
    >
      L
    </div>
  );
}
