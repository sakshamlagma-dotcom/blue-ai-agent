import { useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import MessageBubble from "./components/MessageBubble.jsx";
import AgentActivity from "./components/AgentActivity.jsx";
import Composer from "./components/Composer.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { api } from "./lib/api.js";

const MODES = [
  { id: "chat", label: "Chat" },
  { id: "agent", label: "Agent" },
  { id: "research", label: "Research" },
  { id: "files", label: "Files" },
];

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem("blue-theme") || "dark");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("agent");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [liveSteps, setLiveSteps] = useState([]);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  const abortRef = useRef(false);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("blue-theme", theme);
  }, [theme]);

  useEffect(() => {
    refreshConversations();
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, liveSteps]);

  async function refreshConversations() {
    try {
      const data = await api.listConversations();
      setConversations(data.conversations);
    } catch (e) {
      // Backend may not be running yet; fail silently on initial load.
    }
  }

  async function openConversation(id) {
    setActiveId(id);
    setSidebarOpen(false);
    setError(null);
    try {
      const data = await api.getConversation(id);
      setMessages(data.messages);
      setMode(data.conversation.mode || "agent");
    } catch (e) {
      setError(e.message);
    }
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setError(null);
    setSidebarOpen(false);
  }

  async function handleRename(id, title) {
    await api.renameConversation(id, title);
    refreshConversations();
  }

  async function handleDelete(id) {
    await api.deleteConversation(id);
    if (id === activeId) startNewChat();
    refreshConversations();
  }

  async function handleAttach(files) {
    try {
      const { attachments } = await api.uploadFiles(files);
      setPendingFiles((prev) => [...prev, ...attachments]);
    } catch (e) {
      setError(e.message);
    }
  }

  function removePendingFile(index) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function sendMessage(text) {
    if (!text && pendingFiles.length === 0) return;
    setError(null);
    const attachmentsToSend = pendingFiles;
    setPendingFiles([]);

    const userMsg = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      attachments: attachmentsToSend,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsSending(true);
    setLiveSteps([{ label: "Understanding request", status: "active" }]);
    abortRef.current = false;

    try {
      const res = await api.sendMessage({
        message: text || "Please analyze the attached file(s).",
        conversationId: activeId,
        mode,
        attachments: attachmentsToSend,
      });

      if (abortRef.current) return;

      if (!activeId) {
        setActiveId(res.conversationId);
        refreshConversations();
      } else {
        refreshConversations();
      }

      setMessages((prev) => [...prev, res.message]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", content: e.message, isError: true },
      ]);
    } finally {
      setIsSending(false);
      setLiveSteps([]);
    }
  }

  function handleStop() {
    abortRef.current = true;
    setIsSending(false);
    setLiveSteps([]);
  }

  function handleRegenerate(message) {
    const idx = messages.findIndex((m) => m.id === message.id);
    const priorUser = [...messages.slice(0, idx)].reverse().find((m) => m.role === "user");
    if (priorUser) sendMessage(priorUser.content);
  }

  function handleEdit(message) {
    const newText = prompt("Edit your message:", message.content);
    if (newText && newText.trim()) sendMessage(newText.trim());
  }

  function handleCopy(text) {
    navigator.clipboard?.writeText(text || "");
  }

  return (
    <div className="app-shell">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={openConversation}
        onNew={startNewChat}
        onRename={handleRename}
        onDelete={handleDelete}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="main">
        <div className="topbar">
          <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>☰</button>

          <div className="mode-switch">
            {MODES.map((m) => (
              <button
                key={m.id}
                className={`mode-btn ${mode === m.id ? "active" : ""}`}
                onClick={() => setMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="topbar-actions">
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? "☀" : "🌙"}
            </button>
            <button className="settings-btn" onClick={() => setSettingsOpen(true)}>⚙ Settings</button>
          </div>
        </div>

        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="empty-state">
              <div className="empty-orb" />
              <div className="empty-title">Hi, I'm Blue.</div>
              <div className="empty-sub">
                What would you like me to work on? I can search the web, read your files, do
                calculations, and work through multi-step tasks.
              </div>
              <div className="suggestion-row">
                <button className="suggestion-chip" onClick={() => sendMessage("What can you help me with?")}>
                  What can you do?
                </button>
                <button className="suggestion-chip" onClick={() => sendMessage("Find the latest news on renewable energy and summarize it.")}>
                  Research a topic
                </button>
                <button className="suggestion-chip" onClick={() => sendMessage("Calculate 15% tip on a bill of 2450.")}>
                  Do a calculation
                </button>
              </div>
              {health && !health.geminiConfigured && (
                <div style={{ color: "var(--warning)", fontSize: 12.5, marginTop: 10 }}>
                  ⚠ No GEMINI_API_KEY configured on the server — add one to server/.env to enable responses.
                </div>
              )}
            </div>
          ) : (
            <div className="chat-inner">
              {messages.map((m) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isError={m.isError}
                  onCopy={handleCopy}
                  onRegenerate={m.role === "assistant" ? handleRegenerate : null}
                  onEdit={m.role === "user" ? handleEdit : null}
                />
              ))}
              {isSending && (
                <div className="message-row assistant">
                  <div className="avatar assistant">B</div>
                  <AgentActivity steps={liveSteps} />
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div style={{ textAlign: "center", color: "var(--error)", fontSize: 12.5, padding: "0 20px 6px" }}>
            {error}
          </div>
        )}

        <Composer
          onSend={sendMessage}
          onStop={handleStop}
          isSending={isSending}
          pendingFiles={pendingFiles}
          onAttach={handleAttach}
          onRemoveFile={removePendingFile}
        />
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onThemeChange={setTheme}
        health={health}
      />
    </div>
  );
}
