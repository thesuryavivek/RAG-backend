import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { encoding_for_model } from 'tiktoken';
import type { ingestDatatype } from '../schemas/ingestSchema.js';
import { logger } from './logger.js';

// @ts-expect-error puppeteer-extra types don't align with ESM
puppeteer.use(StealthPlugin());

export const chunkByTokens = (
  text: string,
  { chunkSize = 500, overlap = 80 } = {},
) => {
  const textDecoder = new TextDecoder();
  const enc = encoding_for_model('gpt-5-nano');

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

const cleanPlainText = (text: string) => {
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .normalize('NFKC');
};

const extractTextFromHTML = (html: string, url: string) => {
  const dom = new JSDOM(html, { url });

  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (!article?.textContent) {
    logger.warn({ url }, 'No text content found from Readability');
    return null;
  }

  return article.textContent;
};

const fetchWithBrowser = async (url: string): Promise<string | null> => {
  let browser;
  try {
    logger.info({ url }, 'Falling back to stealth browser');
    // @ts-expect-error puppeteer-extra types don't align with ESM
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 });

    const html = await page.content();
    return html;
  } catch (err) {
    logger.error({ err, url }, 'Stealth browser fetch failed');
    return null;
  } finally {
    await browser?.close();
  }
};

const fetchWithJinaReader = async (url: string): Promise<string | null> => {
  try {
    logger.info({ url }, 'Falling back to Jina Reader');
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Accept: 'text/plain',
      },
    });

    if (!res.ok) {
      logger.warn(
        { url, status: res.status },
        'Jina Reader returned non-OK status',
      );
      return null;
    }

    const text = await res.text();
    return text || null;
  } catch (err) {
    logger.error({ err, url }, 'Jina Reader fetch failed');
    return null;
  }
};

export const cleanData = async (data: ingestDatatype) => {
  if (data.type === 'note') {
    return cleanPlainText(data.text);
  }

  if (data.type === 'url') {
    const res = await fetch(data.url);
    const html = await res.text();
    let text = res.ok ? extractTextFromHTML(html, data.url) : null;

    if (!text) {
      const browserHtml = await fetchWithBrowser(data.url);
      if (browserHtml) {
        text = extractTextFromHTML(browserHtml, data.url);
      }
    }

    if (!text) {
      text = await fetchWithJinaReader(data.url);
    }

    if (!text) {
      return 'No content found';
    }

    return cleanPlainText(text);
  }
};
