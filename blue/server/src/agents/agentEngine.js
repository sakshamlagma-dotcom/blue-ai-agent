import { getProvider } from "../providers/providerRegistry.js";
import { getAllTools, getToolByName, toolDescriptorsForModel } from "../tools/toolRegistry.js";
import { env } from "../config/env.js";

const SYSTEM_PROMPT = `You are Blue, a helpful personal AI agent. Tagline: "Think. Plan. Act."
You can use tools (web_search, calculator, file_reader, url_reader) when they would genuinely help answer the request.
Rules:
- Only call a tool when it is actually needed. Do not call tools for things you already know with certainty and that don't need to be current.
- For current events, recent facts, or anything time-sensitive, ALWAYS use web_search instead of guessing.
- When you use web_search or url_reader, cite the source URLs in your final answer.
- If a tool fails, acknowledge it honestly and try a different approach or explain the limitation. Never pretend a failed action succeeded.
- Give a clear, well-organized final answer. Use markdown (headings, lists, code blocks) when it improves clarity.
- Reply in the same language/style the user used (English, Hindi, or Hinglish/Roman Hindi) naturally.
- Never reveal internal chain-of-thought reasoning; just act and explain results concisely.`;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Runs the agent loop for a single user turn.
 * @param {object} params
 * @param {Array} params.history - prior messages [{role, content}]
 * @param {string} params.userMessage
 * @param {string} params.mode - 'chat' | 'agent' | 'research' | 'files'
 * @param {function} params.onStep - callback(stepEvent) for live activity UI
 * @returns {Promise<{text, steps, toolCalls}>}
 */
export async function runAgent({ history = [], userMessage, mode = "agent", onStep = () => {} }) {
  const provider = getProvider();
  const startTime = Date.now();
  const steps = [];
  const toolCallLog = [];

  const emit = (label, status) => {
    const step = { label, status, at: Date.now() - startTime };
    steps.push(step);
    onStep(step);
  };

  emit("Understanding request", "done");

  const useTools = mode === "agent" || mode === "research" || mode === "files";
  const tools = useTools ? toolDescriptorsForModel() : undefined;

  const messages = [...history, { role: "user", content: userMessage }];

  let toolCallCount = 0;
  let finalText = "";

  for (let stepIndex = 0; stepIndex < env.agent.maxSteps; stepIndex++) {
    if (Date.now() - startTime > env.agent.totalTimeoutMs) {
      emit("Stopped: total time limit reached", "error");
      finalText =
        finalText ||
        "I ran out of time working on this. Here's what I could gather so far — try asking again with a narrower request.";
      break;
    }

    emit(stepIndex === 0 ? "Planning approach" : "Continuing task", "active");

    let result;
    try {
      result = await withTimeout(
        provider.generate({ messages, systemPrompt: SYSTEM_PROMPT, tools }),
        env.agent.stepTimeoutMs,
        "Model call"
      );
    } catch (err) {
      emit(`Error: ${err.message}`, "error");
      throw err;
    }

    if (result.toolCalls && result.toolCalls.length > 0) {
      // Respect the max-tool-calls budget: only execute as many of this
      // turn's calls as remain in the budget; the rest are simply not run.
      const callsToExecute = [];
      let limitReached = false;
      for (const call of result.toolCalls) {
        if (toolCallCount + callsToExecute.length >= env.agent.maxToolCalls) {
          limitReached = true;
          break;
        }
        callsToExecute.push(call);
      }

      const toolResponses = [];
      for (const call of callsToExecute) {
        const tool = getToolByName(call.name);
        emit(describeTool(call.name, call.args), "active");

        let toolResult;
        let toolError = null;
        try {
          if (!tool) throw new Error(`Unknown tool "${call.name}"`);
          toolResult = await withTimeout(
            tool.execute(call.args || {}),
            env.agent.stepTimeoutMs,
            call.name
          );
          emit(describeTool(call.name, call.args), "done");
        } catch (err) {
          toolError = err.message;
          toolResult = { error: err.message };
          emit(`${describeTool(call.name, call.args)} — failed: ${err.message}`, "error");
        }

        toolCallCount++;
        toolCallLog.push({ name: call.name, args: call.args, error: toolError, result: toolResult });
        toolResponses.push({ name: call.name, content: JSON.stringify(toolResult) });
      }

      if (callsToExecute.length > 0) {
        // One assistant turn declaring ALL function calls the model made this
        // step, followed by one turn carrying all their responses in the same
        // order — matches the shape the Gemini API expects for a multi-call turn.
        messages.push({
          role: "assistant",
          content: result.text || "",
          parts: [
            ...(result.text ? [{ text: result.text }] : []),
            ...callsToExecute.map((call) => ({
              functionCall: { name: call.name, args: call.args },
            })),
          ],
        });
        messages.push({ role: "tool", results: toolResponses });
      }

      if (limitReached) {
        emit("Reached maximum tool call limit", "error");
        finalText = result.text || "I reached my tool-use limit for this task.";
        return { text: finalText, steps, toolCalls: toolCallLog };
      }

      continue; // let the model observe tool results and decide next action
    }

    // No tool calls: this is the final answer
    finalText = result.text;
    emit("Preparing final answer", "done");
    break;
  }

  if (!finalText) {
    finalText =
      "I wasn't able to reach a final answer within my step limit. Could you rephrase or narrow the request?";
  }

  return { text: finalText, steps, toolCalls: toolCallLog };
}

function describeTool(name, args) {
  switch (name) {
    case "web_search":
      return `Searching the web: "${args?.query ?? ""}"`;
    case "calculator":
      return `Calculating: ${args?.expression ?? ""}`;
    case "file_reader":
      return `Reading uploaded file: ${args?.fileId ?? ""}`;
    case "url_reader":
      return `Reading source: ${args?.url ?? ""}`;
    default:
      return `Running tool: ${name}`;
  }
}
