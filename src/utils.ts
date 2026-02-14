import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { encoding_for_model } from "tiktoken";
import type { DataSource } from "./index.js";
import { openai } from "./services/openaiClient.js";

const cleanPlainText = (text: string) => {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .normalize("NFKC");
};

const extractTextFromHTML = (html: string, url: string) => {
  const dom = new JSDOM(html, { url });

  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article?.textContent) {
    console.log("No text content found");
    return null;
  }

  return article.textContent;
};

export const chunkByTokens = (
  text: string,
  { chunkSize = 500, overlap = 80 } = {},
) => {
  const textDecoder = new TextDecoder();
  const enc = encoding_for_model("gpt-5");

  const tokens = enc.encode(text);
  const chunks = [];

  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length);

    const chunkTokens = tokens.slice(start, end);
    const chunkText = textDecoder.decode(enc.decode(chunkTokens));

    chunks.push(chunkText);

    start += chunkSize - overlap;
  }

  enc.free();
  return chunks;
};

export const cleanData = async (data: DataSource) => {
  if (data.type === "note") {
    return cleanPlainText(data.text);
  }

  if (data.type === "url") {
    const res = await fetch(data.url);
    const html = await res.text();
    const text = extractTextFromHTML(html, data.url);

    if (!text) {
      return "No content found";
    }

    return cleanPlainText(text);
  }
};
