export type SourceItem = {
  id: string;
  title: string;
  type: string;
  community: boolean;
  score?: number;
};

type SourceCitationProps = {
  source: SourceItem;
};

export function SourceCitation({ source }: SourceCitationProps) {
  return (
    <div
      className="inline-flex max-w-full flex-col rounded-xl border border-white/10 bg-[#2f2f2f]/80 px-3 py-2 text-left text-xs text-zinc-400"
      title={source.title}
    >
      <span className="truncate font-medium text-zinc-300">{source.title}</span>
      <span className="mt-1 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
          {source.type}
        </span>
        {source.community ? (
          <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-400">
            Communaute
          </span>
        ) : null}
      </span>
    </div>
  );
}
