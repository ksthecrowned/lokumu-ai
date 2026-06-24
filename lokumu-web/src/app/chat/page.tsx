"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export default function ChatPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [mode, setMode] = useState<"chat" | "code">("chat");
  const [language, setLanguage] = useState<"fr" | "en" | "lin" | "kit" | "swa">("fr");
  const [isLoading, setIsLoading] = useState(false);

  const languageNames: Record<string, string> = {
    fr: "Français",
    en: "English",
    lin: "Lingála",
    kit: "Kitúba",
    swa: "Kiswahili",
  };

  useEffect(() => {
    const s = io("http://localhost:3000");
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, []);

  const sendMessage = async () => {
    if (!socket || !message) return;

    setIsLoading(true);
    socket.emit("message", { prompt: message, language });

    // Reset response when sending new message
    setResponse("");

    socket.on(
      "stream",
      (data: { chunk: string; done: boolean; mode: "chat" | "code" }) => {
        setResponse((prev) => prev + data.chunk);
        setMode(data.mode);
        }
      },
    );
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Lokumu AI</h1>
        <div>
          <label htmlFor="language-select" style={{ marginRight: "0.5rem" }}>
            Language:
          </label>
          <select
            id="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            style={{ padding: "0.5rem" }}
          >
            {Object.entries(languageNames).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask me anything or request code..."
          style={{ width: "100%", height: "100px" }}
        />
      </div>

      <button
        onClick={sendMessage}
        disabled={!message || isLoading}
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: isLoading ? "#ccc" : "#0070f3",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: isLoading ? "not-allowed" : "pointer"
        }}
      >
        {isLoading ? "Sending..." : "Send"}
      </button>

      {mode === "chat" && (
        <div
          style={{ marginTop: "1.5rem", padding: "1rem", background: "#f5f5f5", borderRadius: "4px" }}
        >
          <h2>Response:</h2>
          <pre>{response}</pre>
        </div>
      )}

      {mode === "code" && (
        <div
          style={{ marginTop: "1.5rem", padding: "1rem", background: "#f5f5f5", borderRadius: "4px" }}
        >
          <h2>Generated Code:</h2>
          <pre>{response}</pre>
        </div>
      )}
    </div>
  );
}
