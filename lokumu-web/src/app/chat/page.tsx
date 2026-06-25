"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatWindow } from "../../components/chat/ChatWindow";
import { CorrectionForm } from "../../components/chat/CorrectionForm";
import { SourceItem } from "../../components/chat/SourceCitation";
import { SuggestedQuestions } from "../../components/chat/SuggestedQuestions";
import { CommunityStats } from "../../components/demo/CommunityStats";
import { DemoHeader } from "../../components/demo/DemoHeader";
import { OfflineBadge } from "../../components/demo/OfflineBadge";
import { SaveForTrainingButton } from "../../components/train/SaveForTrainingButton";
import { UiLanguage } from "../../lib/languages";
import { getSocket } from "../../lib/socket";

type MessageState = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceItem[];
  messageId?: string;
  conversationId?: string;
  originalQuery?: string;
};

type StreamPayload = {
  chunk: string;
  done: boolean;
  mode: "chat";
  sources: SourceItem[];
  messageId?: string;
  conversationId?: string;
};

const DEFAULT_LANGUAGE = "fr" as UiLanguage;

function toInternalLanguage(language: UiLanguage): "fra" | "eng" | "lin" | "kit" {
  if (language === "fr") return "fra";
  if (language === "en") return "eng";
  return language;
}

export default function ChatPage() {
  const [language, setLanguage] = useState<UiLanguage>(DEFAULT_LANGUAGE);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<MessageState[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const socketRef = useRef(getSocket());
  const activeAssistantId = useRef<string | null>(null);
  const latestUserPrompt = useRef<string>("");
  const conversationIdRef = useRef<string | null>(null);
  const streamTimeoutRef = useRef<number | null>(null);

  const clearStreamTimeout = useCallback(() => {
    if (streamTimeoutRef.current !== null) {
      window.clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
  }, []);

  const submitContribution = useCallback(
    (
      assistantMessage: MessageState,
      correctedAnswer: string,
      contributorNote?: string,
    ) => {
      const originalQuery =
        assistantMessage.originalQuery ?? latestUserPrompt.current;
      socketRef.current.emit("contribution:submit", {
        conversationId: assistantMessage.conversationId,
        messageId: assistantMessage.messageId,
        language: toInternalLanguage(language),
        originalQuery,
        originalAnswer: assistantMessage.content,
        correctedAnswer,
        contributorNote,
      });
      setNotice("Merci — votre correction enrichit Lokumu.");
    },
    [language],
  );

  useEffect(() => {
    const socket = socketRef.current;

    const onStream = (payload: StreamPayload) => {
      if (payload.conversationId) {
        conversationIdRef.current = payload.conversationId;
      }

      setMessages((current) => {
        const targetId =
          activeAssistantId.current ??
          [...current]
            .reverse()
            .find((message) => message.role === "assistant")?.id;

        if (!targetId) return current;

        return current.map((message) =>
          message.id !== targetId
            ? message
            : {
                ...message,
                content: payload.chunk
                  ? message.content
                    ? `${message.content}${payload.chunk}`
                    : payload.chunk
                  : message.content,
                sources:
                  payload.sources.length > 0 ? payload.sources : message.sources,
                messageId: payload.messageId ?? message.messageId,
                conversationId:
                  payload.conversationId ?? message.conversationId,
              },
        );
      });

      if (payload.done) {
        clearStreamTimeout();
        setIsStreaming(false);
        activeAssistantId.current = null;
      }
    };

    const onContributionStatus = (payload: { status: string }) => {
      if (payload.status === "approved") {
        setNotice("Correction intégrée au corpus culturel.");
        return;
      }
      setNotice("Correction enregistrée.");
    };

    const resetStreaming = () => {
      clearStreamTimeout();
      setIsStreaming(false);
    };

    socket.on("stream", onStream);
    socket.on("contribution:status", onContributionStatus);
    return () => {
      socket.off("stream", onStream);
      socket.off("contribution:status", onContributionStatus);
    };
  }, [clearStreamTimeout]);

  const sendPrompt = useCallback(
    (text?: string) => {
      const nextPrompt = (text ?? prompt).trim();
      if (isStreaming || !nextPrompt) return;

      latestUserPrompt.current = nextPrompt;
      setPrompt("");

      const userId = crypto.randomUUID();
      const assistantId = crypto.randomUUID();
      activeAssistantId.current = assistantId;
      setIsStreaming(true);
      setNotice(null);

      setMessages((current) => [
        ...current,
        { id: userId, role: "user", content: nextPrompt },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          originalQuery: nextPrompt,
        },
      ]);

      clearStreamTimeout();
      streamTimeoutRef.current = window.setTimeout(() => {
        setIsStreaming(false);
        setMessages((current) => {
          const targetId =
            activeAssistantId.current ??
            [...current]
              .reverse()
              .find((message) => message.role === "assistant" && !message.content.trim())
              ?.id;

          if (!targetId) return current;

          return current.map((message) =>
            message.id === targetId && !message.content.trim()
              ? {
                  ...message,
                  content:
                    "Pas de reponse du serveur. Verifiez que l'API tourne (port 7001) et rechargez la page.",
                }
              : message,
          );
        });
        activeAssistantId.current = null;
        streamTimeoutRef.current = null;
      }, 30_000);

      const emitMessage = () => {
        socketRef.current.emit("message", {
          prompt: nextPrompt,
          language: toInternalLanguage(language),
          conversationId: conversationIdRef.current ?? undefined,
        });
      };

      if (socketRef.current.connected) {
        emitMessage();
      } else {
        socketRef.current.once("connect", emitMessage);
        socketRef.current.connect();
      }
    },
    [clearStreamTimeout, isStreaming, language, prompt],
  );

  const chatMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        correctionSlot:
          message.role === "assistant" && message.content.trim() ? (
            <CorrectionForm
              onSubmit={async ({ correctedAnswer, contributorNote }) => {
                submitContribution(message, correctedAnswer, contributorNote);
              }}
            />
          ) : undefined,
      })),
    [messages, submitContribution],
  );

  const showWelcome = messages.length === 0 && !isStreaming;
  const showChat = messages.length > 0 || isStreaming;

  return (
    <main className="mx-auto flex h-dvh max-w-3xl flex-col bg-slate-50">
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <DemoHeader language={language} onLanguageChange={setLanguage} />
          <OfflineBadge />
        </div>
      </header>

      <div className="lokumu-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {showWelcome ? (
          <div className="mx-auto max-w-lg space-y-4 pt-8 text-center">
            <p className="text-2xl font-semibold text-slate-900">Mbote 👋</p>
            <p className="text-sm text-slate-600">
              Posez une question en français, anglais, lingala ou kituba.
              Réponses générées <strong>100 % en local</strong>.
            </p>
            <SuggestedQuestions
              language={language}
              disabled={isStreaming}
              onSelect={(question) => sendPrompt(question)}
            />
          </div>
        ) : null}
        {showChat ? (
          <>
            <ChatWindow messages={chatMessages} isTyping={isStreaming} />
            <SaveForTrainingButton messages={messages} language={language} />
          </>
        ) : null}
      </div>

      {notice ? (
        <div className="mx-4 mb-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}

      <footer className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
        {!showWelcome ? (
          <div className="mb-2">
            <SuggestedQuestions
              language={language}
              disabled={isStreaming}
              onSelect={(question) => sendPrompt(question)}
            />
          </div>
        ) : null}
        <div className="flex gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendPrompt();
              }
            }}
            placeholder="Votre question…"
            disabled={isStreaming}
            className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none ring-lokumu-primary focus:ring-2 disabled:opacity-60"
          />
          <button
            type="button"
            onClick={() => sendPrompt()}
            disabled={isStreaming || !prompt.trim()}
            className="shrink-0 rounded-xl bg-lokumu-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isStreaming ? "…" : "Envoyer"}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
          <CommunityStats />
          <span>Entrée pour envoyer</span>
        </div>
      </footer>
    </main>
  );
}
