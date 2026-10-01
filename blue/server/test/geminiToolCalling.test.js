import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.GEMINI_API_KEY = "unit-test-placeholder";

const { geminiProvider } = await import("../src/providers/geminiProvider.js");
const { runAgent } = await import("../src/agents/agentEngine.js");
const { errorHandler } = await import("../src/middleware/errorHandler.js");
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function geminiResponse(parts) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts }, finishReason: "STOP" }],
    }),
    text: async () => "",
  };
}

function stubGeminiResponses(responses, requests = []) {
  let responseIndex = 0;
  globalThis.fetch = async (url, options) => {
    if (!String(url).startsWith("https://generativelanguage.googleapis.com/")) {
      if (String(url).startsWith("https://lite.duckduckgo.com/")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            '<table><tr><td><a class="result-link" href="https://example.com/result">Example result</a></td></tr></table>',
        };
      }
      throw new Error("Unexpected test request.");
    }

    requests.push(JSON.parse(options.body));
    const response = responses[responseIndex++];
    if (!response) throw new Error("Unexpected Gemini request.");
    return geminiResponse(response);
  };
}

test("parses a normal text-only Gemini response", async () => {
  stubGeminiResponses([[{ text: "Hello from Gemini." }]]);

  const result = await geminiProvider.generate({
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(result.text, "Hello from Gemini.");
  assert.deepEqual(result.toolCalls, []);
});

test("retries transient Gemini gateway errors before succeeding", async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    if (attempts === 1) {
      return {
        ok: false,
        status: 503,
        text: async () => "Service unavailable",
      };
    }
    return geminiResponse([{ text: "Recovered response." }]);
  };

  const result = await geminiProvider.generate({
    messages: [{ role: "user", content: "Hello" }],
  });

  assert.equal(attempts, 2);
  assert.equal(result.text, "Recovered response.");
});

test("reports a persistent Gemini 502 with its provider status", async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return {
      ok: false,
      status: 502,
      text: async () => "Bad gateway",
    };
  };

  await assert.rejects(
    geminiProvider.generate({
      messages: [{ role: "user", content: "Hello" }],
    }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.code, "AI_PROVIDER_ERROR");
      return true;
    }
  );
  assert.equal(attempts, 3);
});

test("surfaces a safe, actionable message for persistent Gemini 5xx errors", () => {
  const originalConsoleError = console.error;
  let response;
  console.error = () => {};

  try {
    errorHandler(
      Object.assign(new Error("provider details stay server-side"), {
        status: 502,
        code: "AI_PROVIDER_ERROR",
      }),
      { method: "POST", path: "/api/chat" },
      {
        status(status) {
          response = { status };
          return this;
        },
        json(body) {
          response.body = body;
        },
      }
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(response, {
    status: 502,
    body: {
      error: "The AI service is temporarily unavailable (HTTP 502). Please try again shortly.",
    },
  });
});

test("retains the complete Gemini Part and signature on a web_search call", async () => {
  const functionCallPart = {
    functionCall: {
      name: "web_search",
      args: { query: "Blue AI" },
      id: "search-call-1",
    },
    thoughtSignature: "opaque-signature-from-gemini",
  };
  const requests = [];
  stubGeminiResponses(
    [[functionCallPart], [{ text: "Here is the search result." }]],
    requests
  );

  const result = await runAgent({
    userMessage: "Search for Blue AI.",
    mode: "agent",
  });

  assert.equal(result.text, "Here is the search result.");
  assert.equal(result.toolCalls[0].name, "web_search");
  assert.deepEqual(
    requests[0].tools[0].functionDeclarations.map((declaration) => declaration.name),
    ["web_search", "calculator", "file_reader", "url_reader"]
  );
  assert.deepEqual(requests[1].contents[1], {
    role: "model",
    parts: [functionCallPart],
  });
  assert.deepEqual(requests[1].contents[2].parts[0].functionResponse, {
    id: "search-call-1",
    name: "web_search",
    response: {
      result: JSON.stringify({
        query: "Blue AI",
        results: [
          {
            title: "Example result",
            url: "https://example.com/result",
            snippet: "",
          },
        ],
      }),
    },
  });
});

test("preserves each original Part and matches multiple function responses by ID", async () => {
  const searchPart = {
    functionCall: {
      name: "web_search",
      args: { query: "Blue AI" },
      id: "search-call-2",
    },
    thoughtSignature: "search-signature",
  };
  const calculatorPart = {
    functionCall: {
      name: "calculator",
      args: { expression: "7 * 8" },
      id: "calculator-call-2",
    },
    thoughtSignature: "calculator-signature",
  };
  const requests = [];
  stubGeminiResponses(
    [[searchPart, calculatorPart], [{ text: "The result is 56." }]],
    requests
  );

  const result = await runAgent({
    userMessage: "Search Blue AI and calculate 7 times 8.",
    mode: "agent",
  });

  assert.equal(result.text, "The result is 56.");
  const nextRequest = requests[1];
  assert.deepEqual(nextRequest.contents[1], {
    role: "model",
    parts: [searchPart, calculatorPart],
  });
  const functionResponses = nextRequest.contents[2].parts.map(
    (part) => part.functionResponse
  );
  assert.deepEqual(
    functionResponses.map(({ id, name }) => ({ id, name })),
    [
      { id: "search-call-2", name: "web_search" },
      { id: "calculator-call-2", name: "calculator" },
    ]
  );
  assert.equal(
    JSON.parse(functionResponses[1].response.result).result,
    56
  );
});

test("keeps legacy function-call history without a thought signature valid", async () => {
  const legacyPart = {
    functionCall: { name: "web_search", args: { query: "legacy query" } },
  };
  const requests = [];
  stubGeminiResponses([[{ text: "Legacy history accepted." }]], requests);

  const result = await geminiProvider.generate({
    messages: [
      { role: "assistant", parts: [legacyPart] },
      {
        role: "tool",
        results: [
          {
            name: "web_search",
            content: JSON.stringify({ results: [] }),
          },
        ],
      },
      { role: "user", content: "Continue." },
    ],
  });

  assert.equal(result.text, "Legacy history accepted.");
  assert.deepEqual(requests[0].contents[0], {
    role: "model",
    parts: [legacyPart],
  });
  assert.deepEqual(requests[0].contents[1].parts[0].functionResponse, {
    name: "web_search",
    response: { result: JSON.stringify({ results: [] }) },
  });
  assert.equal("thoughtSignature" in requests[0].contents[0].parts[0], false);
  assert.equal("id" in requests[0].contents[1].parts[0].functionResponse, false);
});
