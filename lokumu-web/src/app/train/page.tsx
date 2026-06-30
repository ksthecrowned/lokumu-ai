"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatHeader } from "../../components/chat/ChatHeader";
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
    <div className="flex min-h-dvh flex-col bg-[#212121] text-zinc-100">
      <ChatHeader
        language={uiLanguage}
        onLanguageChange={setUiLanguage}
        onNewChat={() => {}}
        title="Entrainement"
      />

      <section className="flex-1 px-4 py-6">
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <div className="rounded-2xl border border-white/10 bg-[#2f2f2f] p-4">
            <p className="text-lg font-semibold text-zinc-100">Contribuer un dialogue</p>
            <p className="mt-1 text-sm text-zinc-400">
              Ajoutez un echange Kituba ou Lingala pour ameliorer les donnees de
              training de Lokumu.
            </p>
            <div className="mt-3 flex items-center gap-3 text-xs">
              <Link
                className="font-medium text-lokumu-primary hover:underline"
                href="/chat"
              >
                Retour au chat
              </Link>
            </div>
          </div>

          {notice ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
              {notice}
            </div>
          ) : null}

          <TrainingDialogueForm onSubmit={submitTrainingDialogue} />

          {isSubmitting ? (
            <p className="text-xs text-zinc-500">Transmission en cours via websocket...</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
