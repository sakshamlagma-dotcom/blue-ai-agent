import { useRef, useState } from "react";

export default function Composer({ onSend, onStop, isSending, pendingFiles, onAttach, onRemoveFile }) {
  const [text, setText] = useState("");
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  function handleSend() {
    if (!text.trim() && pendingFiles.length === 0) return;
    onSend(text.trim());
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function autoGrow(e) {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  }

  return (
    <div className="composer-wrap">
      {pendingFiles.length > 0 && (
        <div className="pending-attachments">
          {pendingFiles.map((f, i) => (
            <div className="attachment-chip" key={i}>
              📎 {f.name}
              <button
                className="icon-btn"
                style={{ marginLeft: 4 }}
                onClick={() => onRemoveFile(i)}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="composer">
        <button
          className="composer-btn"
          title="Attach file"
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept=".pdf,.txt,.docx,.csv,.json,.png,.jpg,.jpeg,.webp,.gif"
          onChange={(e) => {
            if (e.target.files.length) onAttach(Array.from(e.target.files));
            e.target.value = "";
          }}
        />

        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Message Blue... (Shift+Enter for new line)"
          value={text}
          onChange={autoGrow}
          onKeyDown={handleKeyDown}
        />

        {isSending ? (
          <button className="composer-btn stop-btn" onClick={onStop} title="Stop generating">
            ■
          </button>
        ) : (
          <button
            className="composer-btn send-btn"
            onClick={handleSend}
            disabled={!text.trim() && pendingFiles.length === 0}
            title="Send"
          >
            ➤
          </button>
        )}
      </div>

      <div className="hint-row">
        <span>Blue can make mistakes. Verify important information.</span>
        <span>Enter to send · Shift+Enter for new line</span>
      </div>
    </div>
  );
}
