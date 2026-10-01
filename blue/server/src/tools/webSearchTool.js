import * as cheerio from "cheerio";
import { env } from "../config/env.js";

async function searchDuckDuckGo(query, maxResults) {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    },
  });
  if (!res.ok) {
    throw new Error(`DuckDuckGo search failed with status ${res.status}`);
  }
  const html = await res.text();
  const $ = cheerio.load(html);
  const results = [];

  $("a.result-link, a[href^='http']").each((_, el) => {
    if (results.length >= maxResults) return;
    const href = $(el).attr("href");
    const title = $(el).text().trim();
    if (!href || !title) return;
    if (href.includes("duckduckgo.com")) return;
    if (results.some((r) => r.url === href)) return;
    results.push({ title, url: href, snippet: "" });
  });

  // Attach snippets that follow each result row in the lite layout
  $("tr").each((_, el) => {
    const text = $(el).find("td.result-snippet").text().trim();
    if (!text) return;
    const link = $(el).prevAll("tr").find("a[href^='http']").first().attr("href");
    const match = results.find((r) => r.url === link);
    if (match && !match.snippet) match.snippet = text;
  });

  return results.slice(0, maxResults);
}

async function searchSerpApi(query, maxResults) {
  if (!env.serpapiKey) {
    throw new Error(
      "SEARCH_PROVIDER=serpapi requires SERPAPI_KEY to be set in server/.env"
    );
  }
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
    query
  )}&api_key=${env.serpapiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI request failed with status ${res.status}`);
  const data = await res.json();
  return (data.organic_results || []).slice(0, maxResults).map((r) => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet || "",
  }));
}

export const webSearchTool = {
  name: "web_search",
  description:
    "Search the live web for current information, news, facts, or anything the model's own knowledge may be outdated on. Returns a list of {title, url, snippet}. Use this whenever the user asks about recent events, current data, or anything requiring up-to-date sources.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query." },
      maxResults: {
        type: "integer",
        description: "Max number of results to return (default 5, max 10).",
      },
    },
    required: ["query"],
  },
  async execute({ query, maxResults = 5 }) {
    if (!query || typeof query !== "string" || !query.trim()) {
      throw new Error("web_search requires a non-empty 'query' string.");
    }
    const capped = Math.min(Math.max(Number(maxResults) || 5, 1), 10);
    const provider = env.searchProvider === "serpapi" ? searchSerpApi : searchDuckDuckGo;
    const results = await provider(query.trim(), capped);
    if (results.length === 0) {
      return { query, results: [], note: "No results found for this query." };
    }
    return { query, results };
  },
};
