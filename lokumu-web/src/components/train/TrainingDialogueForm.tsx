"use client";

import { FormEvent, useMemo, useState } from "react";

type TrainingRole = "user" | "assistant";
type TrainingLanguage = "kit" | "lin";

type TrainingTurn = {
  role: TrainingRole;
  content: string;
};

export type TrainingDialoguePayload = {
  title: string;
  language: TrainingLanguage;
  turns: Array<{ role: TrainingRole; content: string }>;
  tags: string[];
};

type TrainingDialogueFormProps = {
  onSubmit: (payload: TrainingDialoguePayload) => Promise<void> | void;
};

const EMPTY_TURNS: TrainingTurn[] = [
  { role: "user", content: "" },
  { role: "assistant", content: "" },
];

export function TrainingDialogueForm({ onSubmit }: TrainingDialogueFormProps) {
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<TrainingLanguage>("kit");
  const [tagsInput, setTagsInput] = useState("");
  const [turns, setTurns] = useState<TrainingTurn[]>(EMPTY_TURNS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tagsPreview = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsInput],
  );

  const updateTurn = (index: number, patch: Partial<TrainingTurn>) => {
    setTurns((current) =>
      current.map((turn, turnIndex) =>
        turnIndex === index ? { ...turn, ...patch } : turn,
      ),
    );
  };

  const addTurn = () => {
    setTurns((current) => [
      ...current,
      { role: current.length % 2 === 0 ? "user" : "assistant", content: "" },
    ]);
  };

  const removeTurn = (index: number) => {
    setTurns((current) => current.filter((_, turnIndex) => turnIndex !== index));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const cleanedTitle = title.trim();
    const cleanedTurns = turns
      .map((turn) => ({ ...turn, content: turn.content.trim() }))
      .filter((turn) => turn.content.length > 0);

    if (!cleanedTitle) {
      setFormError("Ajoutez un titre pour ce dialogue.");
      return;
    }

    if (cleanedTurns.length < 2) {
      setFormError("Ajoutez au moins deux tours (user + assistant).");
      return;
    }

    if (!cleanedTurns.some((turn) => turn.role === "user")) {
      setFormError("Le dialogue doit inclure au moins un tour user.");
      return;
    }

    if (!cleanedTurns.some((turn) => turn.role === "assistant")) {
      setFormError("Le dialogue doit inclure au moins un tour assistant.");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: cleanedTitle,
        language,
        turns: cleanedTurns,
        tags: tagsPreview,
      });

      setTitle("");
      setTagsInput("");
      setTurns(EMPTY_TURNS);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="space-y-2">
        <label htmlFor="training-title" className="text-sm font-medium text-slate-700">
          Titre
        </label>
        <input
          id="training-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ex: Salutation entre voisins"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-lokumu-primary focus:ring-2"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-700">Langue principale</p>
        <div className="flex gap-2">
          {(["kit", "lin"] as const).map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold uppercase ${
                language === value
                  ? "border-lokumu-primary bg-lokumu-primary/10 text-lokumu-primary"
                  : "border-slate-300 text-slate-600"
              }`}
            >
              <input
                type="radio"
                name="training-language"
                value={value}
                checked={language === value}
                onChange={() => setLanguage(value)}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="training-tags" className="text-sm font-medium text-slate-700">
          Tags (separes par des virgules)
        </label>
        <input
          id="training-tags"
          type="text"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="greeting, beginner"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-lokumu-primary focus:ring-2"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-700">Tours du dialogue</p>
          <button
            type="button"
            onClick={addTurn}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            + Ajouter un tour
          </button>
        </div>
        {turns.map((turn, index) => (
          <div key={`${index}-${turn.role}`} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <select
                value={turn.role}
                onChange={(event) =>
                  updateTurn(index, { role: event.target.value as TrainingRole })
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold uppercase text-slate-700 outline-none ring-lokumu-primary focus:ring-2"
              >
                <option value="user">user</option>
                <option value="assistant">assistant</option>
              </select>
              {turns.length > 2 ? (
                <button
                  type="button"
                  onClick={() => removeTurn(index)}
                  className="text-xs font-medium text-rose-600 underline decoration-dotted"
                >
                  Supprimer
                </button>
              ) : null}
            </div>
            <textarea
              value={turn.content}
              onChange={(event) => updateTurn(index, { content: event.target.value })}
              rows={3}
              placeholder={turn.role === "user" ? "Question utilisateur..." : "Reponse assistant..."}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-lokumu-primary focus:ring-2"
            />
          </div>
        ))}
      </div>

      {formError ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-lokumu-primary px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSubmitting ? "Envoi..." : "Soumettre le dialogue"}
      </button>
    </form>
  );
}
