"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DemoHeader } from "../../components/demo/DemoHeader";
import { OfflineBadge } from "../../components/demo/OfflineBadge";
import {
  TrainingDialogueForm,
  TrainingDialoguePayload,
} from "../../components/train/TrainingDialogueForm";
import { UiLanguage } from "../../lib/languages";
import { getSocket } from "../../lib/socket";

type TrainingStatusPayload = {
  id: string;
  status: "pending" | "approved" | "exported";
};

const DEFAULT_UI_LANGUAGE = "fr" as UiLanguage;

export default function TrainPage() {
  const [uiLanguage, setUiLanguage] = useState<UiLanguage>(DEFAULT_UI_LANGUAGE);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    const onTrainingStatus = (payload: TrainingStatusPayload) => {
      if (payload.status === "approved") {
        setNotice("Dialogue approuve et ajoute a l'ensemble d'entrainement.");
      } else if (payload.status === "exported") {
        setNotice("Dialogue deja exporte.");
      } else {
        setNotice("Dialogue enregistre. En attente de validation.");
      }
      setIsSubmitting(false);
    };

    socket.on("training:status", onTrainingStatus);
    return () => {
      socket.off("training:status", onTrainingStatus);
    };
  }, []);

  const submitTrainingDialogue = useCallback((payload: TrainingDialoguePayload) => {
    setNotice("Envoi du dialogue...");
    setIsSubmitting(true);

    const emitSubmit = () => {
      socketRef.current.emit("training:submit", payload);
    };

    if (socketRef.current.connected) {
      emitSubmit();
      return;
    }

    socketRef.current.once("connect", emitSubmit);
    socketRef.current.connect();
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <DemoHeader language={uiLanguage} onLanguageChange={setUiLanguage} />
          <OfflineBadge />
        </div>
      </header>

      <section className="flex-1 px-4 py-6">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-lg font-semibold text-slate-900">Contribuer un dialogue</p>
            <p className="mt-1 text-sm text-slate-600">
              Ajoutez un echange Kituba ou Lingala pour ameliorer les donnees de
              training de Lokumu.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <Link className="font-semibold text-lokumu-primary underline decoration-dotted" href="/chat">
                Retour au chat
              </Link>
            </div>
          </div>

          {notice ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {notice}
            </div>
          ) : null}

          <TrainingDialogueForm onSubmit={submitTrainingDialogue} />

          {isSubmitting ? (
            <p className="text-xs text-slate-500">Transmission en cours via websocket...</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
