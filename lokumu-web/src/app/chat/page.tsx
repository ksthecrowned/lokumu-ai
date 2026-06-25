"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChatWindow } from "../../components/chat/ChatWindow";
import { CorrectionForm } from "../../components/chat/CorrectionForm";
import { SourceItem } from "../../components/chat/SourceCitation";
import { SuggestedQuestions } from "../../components/chat/SuggestedQuestions";
import { CommunityStats } from "../../components/demo/CommunityStats";
import { DemoHeader } from "../../components/demo/DemoHeader";
import { DisclaimerBanner } from "../../components/demo/DisclaimerBanner";
import { OfflineBadge } from "../../components/demo/OfflineBadge";
import { UiLanguage, UI_LANGUAGES } from "../../lib/languages";
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

const DEFAULT_LANGUAGE = UI_LANGUAGES[0]?.code ?? "fr";

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

  function submitContribution(
    assistantMessage: MessageState,
    correctedAnswer: string,
    contributorNote?: string,
  ) {
    const originalQuery = assistantMessage.originalQuery ?? latestUserPrompt.current;
    socketRef.current.emit("contribution:submit", {
      conversationId: assistantMessage.conversationId,
      messageId: assistantMessage.messageId,
      language: toInternalLanguage(language),
      originalQuery,
      originalAnswer: assistantMessage.content,
      correctedAnswer,
      contributorNote,
    });
    setNotice("Correction envoyee. Merci.");
  }

  useEffect(() => {
    const socket = socketRef.current;

    const onStream = (payload: StreamPayload) => {
      if (!activeAssistantId.current) return;

      setMessages((current) =>
        current.map((message) =>
          message.id !== activeAssistantId.current
            ? message
            : {
                ...message,
                content: `${message.content}${payload.chunk}`,
                sources: payload.sources,
                messageId: payload.messageId ?? message.messageId,
                conversationId: payload.conversationId ?? message.conversationId,
              },
        ),
      );

      if (payload.done) {
        setIsStreaming(false);
        activeAssistantId.current = null;
      }
    };

    const onContributionStatus = (payload: { status: string }) => {
      if (payload.status === "approved") {
        setNotice("Correction approuvee et ajoutee au corpus.");
        return;
      }

      setNotice("Correction recue. Validation en attente.");
    };

    socket.on("stream", onStream);
    socket.on("contribution:status", onContributionStatus);
    return () => {
      socket.off("stream", onStream);
      socket.off("contribution:status", onContributionStatus);
    };
  }, []);

  const chatMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        correctionSlot:
          message.role === "assistant" && message.content.trim() ? (
            <CorrectionForm
              onSubmit={async ({ correctedAnswer, contributorNote }) => {
                await submitContribution(message, correctedAnswer, contributorNote);
              }}
            />
          ) : undefined,
      })),
    [messages],
  );

  const sendPrompt = () => {
    if (isStreaming) return;
    if (!prompt.trim()) return;

    const nextPrompt = prompt.trim();
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

    socketRef.current.emit("message", { prompt: nextPrompt, language });
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <DemoHeader language={language} onLanguageChange={setLanguage} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <OfflineBadge />
        <CommunityStats />
      </div>

      <DisclaimerBanner />

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
        <SuggestedQuestions language={language} onSelect={setPrompt} />

        <ChatWindow messages={chatMessages} isTyping={isStreaming} />

        <div className="space-y-2">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Posez une question culturelle..."
            rows={4}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-lokumu-primary transition focus:ring-2"
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Langues supportees: {UI_LANGUAGES.map((item) => item.code).join(", ")}
            </p>
            <button
              type="button"
              onClick={sendPrompt}
              disabled={isStreaming || !prompt.trim()}
              className="rounded-lg bg-lokumu-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isStreaming ? "Generation..." : "Envoyer"}
            </button>
          </div>
        </div>
      </section>

      {notice ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
    </main>
  );
}
