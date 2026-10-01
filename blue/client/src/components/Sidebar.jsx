import { useState } from "react";

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  open,
  onClose,
  theme,
}) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase())
  );

  function startRename(c) {
    setRenamingId(c.id);
    setRenameValue(c.title);
  }

  function commitRename(id) {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  }

  return (
    <>
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-orb" />
          <div>
            <div className="brand-text">Blue</div>
            <div className="brand-tagline">Think. Plan. Act.</div>
          </div>
        </div>

        <button className="new-chat-btn" onClick={onNew}>
          + New chat
        </button>

        <input
          className="sidebar-search"
          placeholder="Search conversations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="conversation-list">
          {filtered.length === 0 && (
            <div style={{ color: "var(--text-faint)", fontSize: 12.5, padding: "10px 8px" }}>
              No conversations yet.
            </div>
          )}
          {filtered.map((c) => (
            <div
              key={c.id}
              className={`conversation-item ${c.id === activeId ? "active" : ""}`}
              onClick={() => onSelect(c.id)}
            >
              {renamingId === c.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={(e) => e.key === "Enter" && commitRename(c.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--blue)",
                    borderRadius: 6,
                    color: "var(--text)",
                    padding: "3px 6px",
                    fontSize: 13,
                    width: "100%",
                  }}
                />
              ) : (
                <span className="conversation-title">{c.title}</span>
              )}
              <div className="conversation-actions">
                <button
                  className="icon-btn"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(c);
                  }}
                >
                  ✎
                </button>
                <button
                  className="icon-btn"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${c.title}"?`)) onDelete(c.id);
                  }}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Blue v1.0</span>
        </div>
      </aside>
      <div className={`sidebar-backdrop ${open ? "open" : ""}`} onClick={onClose} />
    </>
  );
}
