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
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
      <div className="font-medium text-slate-900">{source.title}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="rounded bg-slate-100 px-2 py-0.5">{source.type}</span>
        {source.community ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">
            Community
          </span>
        ) : null}
      </div>
    </div>
  );
}
