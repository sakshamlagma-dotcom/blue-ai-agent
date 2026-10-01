import * as cheerio from "cheerio";

export const urlReaderTool = {
  name: "url_reader",
  description:
    "Fetch a specific web page URL (e.g. a result found via web_search) and extract its main readable text content. Use this to read a source in depth before summarizing or citing it.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "Full URL, including https://" },
    },
    required: ["url"],
  },
  async execute({ url }) {
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error("url_reader requires a valid absolute 'url' starting with http(s)://");
    }
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`Could not fetch URL (status ${res.status}).`);
    }
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { url, note: `Non-HTML content-type (${contentType}); cannot extract text.` };
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    $("script, style, nav, footer, header, noscript").remove();
    const title = $("title").text().trim();
    let text = $("body").text().replace(/\s+/g, " ").trim();
    const MAX_CHARS = 12000;
    const truncated = text.length > MAX_CHARS;
    if (truncated) text = text.slice(0, MAX_CHARS);
    return { url, title, truncated, content: text };
  },
};
