import { geminiProvider } from "./geminiProvider.js";
import { env } from "../config/env.js";

// A "provider" must implement:
//   async generate({ messages, systemPrompt, tools, temperature }) -> { text, toolCalls, raw }
//   async generateVision({ messages, imageParts, systemPrompt }) -> { text, raw }
//   name: string
const registry = {
  gemini: geminiProvider,
};

export function getProvider(name = env.aiProvider) {
  const provider = registry[name];
  if (!provider) {
    throw new Error(
      `Unknown AI provider "${name}". Available: ${Object.keys(registry).join(", ")}`
    );
  }
  return provider;
}

export function registerProvider(name, implementation) {
  registry[name] = implementation;
}
