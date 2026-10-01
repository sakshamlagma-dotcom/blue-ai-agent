import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AgentActivity from "./AgentActivity.jsx";

function extractSources(toolCalls) {
  if (!toolCalls) return [];
  const sources = [];
  for (const call of toolCalls) {
    if (call.name === "web_search" && call.result?.results) {
      for (const r of call.result.results) sources.push({ title: r.title, url: r.url });
    }
    if (call.name === "url_reader" && call.result?.url) {
      sources.push({ title: call.result.title || call.result.url, url: call.result.url });
    }
  }
  // de-dupe by url
  const seen = new Set();
  return sources.filter((s) => {
    if (seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

export default function MessageBubble({ message, onCopy, onRegenerate, onEdit, isError }) {
  const isUser = message.role === "user";
  const sources = extractSources(message.tool_calls);

  return (
    <div className={`message-row ${isUser ? "user" : "assistant"}`}>
      <div className={`avatar ${isUser ? "user" : "assistant"}`}>{isUser ? "U" : "B"}</div>
      <div style={{ display: "flex", flexDirection: "column", maxWidth: "78%" }}>
        {message.attachments?.length > 0 && (
          <div className="attachments-row">
            {message.attachments.map((a, i) => (
              <div className="attachment-chip" key={i}>
                📎 {a.name}
              </div>
            ))}
          </div>
        )}

        {message.steps?.length > 0 && !isUser && <AgentActivity steps={message.steps} />}

        <div className={`bubble ${isUser ? "user" : "assistant"} ${isError ? "error" : ""}`}>
          {isUser ? (
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content}</p>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content || ""}</ReactMarkdown>
          )}

          {sources.length > 0 && (
            <div className="sources-row">
              {sources.map((s, i) => (
                <a key={i} className="source-chip" href={s.url} target="_blank" rel="noreferrer">
                  🔗 {s.title || s.url}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="message-actions">
          <button className="mini-btn" onClick={() => onCopy?.(message.content)}>Copy</button>
          {isUser && onEdit && (
            <button className="mini-btn" onClick={() => onEdit(message)}>Edit</button>
          )}
          {!isUser && onRegenerate && (
            <button className="mini-btn" onClick={() => onRegenerate(message)}>Regenerate</button>
          )}
        </div>
      </div>
    </div>
  );
}
