import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { encoding_for_model } from "tiktoken";

export const cleanPlainText = (text: string) => {
  return text
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export const extractTextFromHTML = (html: string, url: string) => {
  const dom = new JSDOM(html, { url });

  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  console.log(article);

  if (!article?.textContent) {
    console.log("No text content found");
    return;
  }

  return cleanPlainText(article.textContent);
};

export const chunkByTokens = (
  text: string,
  { chunkSize = 500, overlap = 80 } = {},
) => {
  const enc = encoding_for_model("gpt-5");

  const tokens = enc.encode(text);
  const chunks = [];

  let start = 0;

  while (start < tokens.length) {
    const end = Math.min(start + chunkSize, tokens.length);

    const chunkTokens = tokens.slice(start, end);
    const chunkText = enc.decode(chunkTokens);

    chunks.push(chunkText);

    start += chunkSize - overlap;
  }

  enc.free();
  return chunks;
};
