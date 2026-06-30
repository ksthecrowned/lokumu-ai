"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "../../components/chat/ChatComposer";
import { ChatHeader } from "../../components/chat/ChatHeader";
import { ChatWindow } from "../../components/chat/ChatWindow";
import { CorrectionForm } from "../../components/chat/CorrectionForm";
import { SourceItem } from "../../components/chat/SourceCitation";
import { SuggestedQuestions } from "../../components/chat/SuggestedQuestions";
import { WelcomeScreen } from "../../components/chat/WelcomeScreen";
import { CommunityStats } from "../../components/demo/CommunityStats";
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

  const startNewChat = useCallback(() => {
    clearStreamTimeout();
    setMessages([]);
    setPrompt("");
    setNotice(null);
    setIsStreaming(false);
    activeAssistantId.current = null;
    conversationIdRef.current = null;
    latestUserPrompt.current = "";
  }, [clearStreamTimeout]);

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
        setNotice("Correction integree au corpus culturel.");
        return;
      }
      setNotice("Correction enregistree.");
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
              .find(
                (message) =>
                  message.role === "assistant" && !message.content.trim(),
              )?.id;

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
    <div className="flex h-dvh flex-col bg-[#212121] text-zinc-100">
      <ChatHeader
        language={language}
        onLanguageChange={setLanguage}
        onNewChat={startNewChat}
      />

      <div className="lokumu-scrollbar min-h-0 flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen
            language={language}
            disabled={isStreaming}
            onSelect={(question) => sendPrompt(question)}
          />
        ) : null}
        {showChat ? (
          <div className="pt-2">
            <ChatWindow messages={chatMessages} isTyping={isStreaming} />
            <div className="mx-auto max-w-3xl px-3 sm:px-4">
              <SaveForTrainingButton messages={messages} language={language} />
            </div>
          </div>
        ) : null}
      </div>

      {notice ? (
        <div className="mx-auto mb-2 w-full max-w-3xl px-3 sm:px-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {notice}
          </div>
        </div>
      ) : null}

      <footer className="shrink-0 border-t border-white/10 bg-[#212121] px-3 py-3 sm:px-4">
        <div className="mx-auto w-full max-w-3xl space-y-2">
          {!showWelcome ? (
            <SuggestedQuestions
              language={language}
              disabled={isStreaming}
              variant="chips"
              onSelect={(question) => sendPrompt(question)}
            />
          ) : null}
          <ChatComposer
            value={prompt}
            onChange={setPrompt}
            onSubmit={() => sendPrompt()}
            disabled={isStreaming}
            placeholder={
              isStreaming ? "Lokumu reflechit…" : "Envoyer un message…"
            }
          />
          <div className="flex items-center justify-center text-[11px] text-zinc-600">
            <CommunityStats />
          </div>
        </div>
      </footer>
    </div>
  );
}
