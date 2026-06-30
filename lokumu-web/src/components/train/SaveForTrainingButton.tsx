"use client";

import { useMemo, useRef, useState } from "react";
import { UiLanguage } from "../../lib/languages";
import { getSocket } from "../../lib/socket";
import {
  TrainingDialogueForm,
  TrainingDialoguePayload,
} from "./TrainingDialogueForm";

type MessageState = {
  role: "user" | "assistant";
  content: string;
};

type SaveForTrainingButtonProps = {
  messages: MessageState[];
  language: UiLanguage;
};

function toTrainingLanguage(language: UiLanguage): "kit" | "lin" {
  return language === "lin" ? "lin" : "kit";
}

export function SaveForTrainingButton({
  messages,
  language,
}: SaveForTrainingButtonProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const socketRef = useRef(getSocket());

  const turns = useMemo(
    () =>
      messages
        .filter((message) => message.content.trim().length > 0)
        .map((message) => ({
          role: message.role,
          content: message.content.trim(),
        })),
    [messages],
  );

  if (turns.length < 2) {
    return null;
  }

  const handleSubmit = async (payload: TrainingDialoguePayload) => {
    setIsSubmitting(true);
    setNotice("Envoi du dialogue...");

    const emitSubmit = () => {
      socketRef.current.emit("training:submit", payload);
    };

    if (socketRef.current.connected) {
      emitSubmit();
    } else {
      socketRef.current.once("connect", emitSubmit);
      socketRef.current.connect();
    }

    setOpen(false);
    setIsSubmitting(false);
    setNotice("Dialogue envoye pour entrainement.");
  };

  return (
    <section className="mb-4 space-y-2 rounded-xl border border-white/10 bg-[#2f2f2f]/50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-zinc-500">
          Enregistrer cette conversation pour le corpus de training.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-zinc-100"
        >
          Enregistrer
        </button>
      </div>

      {notice ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
          {notice}
        </p>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#2f2f2f] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-100">
                Sauvegarder cette conversation
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200"
              >
                Fermer
              </button>
            </div>
            <TrainingDialogueForm
              initial={{
                title: "Conversation chat",
                language: toTrainingLanguage(language),
                turns,
              }}
              onSubmit={handleSubmit}
            />
            {isSubmitting ? (
              <p className="mt-2 text-xs text-zinc-500">
                Transmission en cours via websocket...
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
