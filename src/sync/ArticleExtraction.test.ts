import { describe, it, expect } from "vitest";
import * as cheerio from "cheerio";

function extractArticleContentFromHtml(html: string): {
  title: string;
  author: string;
  publishedAt: string;
  readingTime: number;
  wordCount: number;
  content: string;
} {
  const $ = cheerio.load(html);

  // Strip junk elements
  $(
    "script, style, noscript, nav, footer, header, aside, iframe, form, button, " +
    ".ad, .ads, .advertisement, .sidebar, .menu, .cookie-banner, .popup, " +
    "[role='banner'], [role='navigation'], [role='complementary'], [aria-hidden='true']"
  ).remove();

  const title =
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    "Untitled";

  const author =
    $('meta[name="author"]').attr("content") ||
    $('meta[property="article:author"]').attr("content") ||
    $('meta[name="twitter:creator"]').attr("content") ||
    $('[rel="author"]').first().text().trim() ||
    $(".byline, .author").first().text().trim() ||
    "";

  const publishedAt =
    $('meta[property="article:published_time"]').attr("content") ||
    $('meta[name="date"]').attr("content") ||
    $('meta[name="pubdate"]').attr("content") ||
    $("time[datetime]").first().attr("datetime") ||
    $("time").first().text().trim() ||
    "";

  let $content = $("article");
  if (!$content.length) $content = $("main");
  if (!$content.length) $content = $('[role="main"]');
  if (!$content.length) $content = $(".post-content, .article-content, .entry-content, .content");
  if (!$content.length) $content = $("body");

  const extractedParts: string[] = [];
  $content.find("h1, h2, h3, h4, h5, h6, p, blockquote, ul, ol, pre").each((_, el) => {
    const tagName = (el as any).tagName?.toLowerCase() || "";
    const $el = $(el);
    const text = $el.text().trim();
    if (!text) return;

    if ($el.parents("blockquote, ul, ol").length > 0 && tagName !== "li") {
      return;
    }

    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
      extractedParts.push(`<${tagName}>${text}</${tagName}>`);
    } else if (tagName === "blockquote") {
      extractedParts.push(`<blockquote><p>${text}</p></blockquote>`);
    } else if (tagName === "pre") {
      extractedParts.push(`<pre><code>${text}</code></pre>`);
    } else if (tagName === "ul" || tagName === "ol") {
      const items: string[] = [];
      $el.children("li").each((_, li) => {
        const liText = $(li).text().trim();
        if (liText) items.push(`<li>${liText}</li>`);
      });
      if (items.length > 0) {
        extractedParts.push(`<${tagName}>${items.join("")}</${tagName}>`);
      }
    } else if (tagName === "p") {
      extractedParts.push(`<p>${text}</p>`);
    }
  });

  const cleanContent = extractedParts.join("\n");
  const plainText = cleanContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const words = plainText ? plainText.split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  return {
    title,
    author,
    publishedAt,
    readingTime,
    wordCount: words,
    content: cleanContent,
  };
}

describe("Edge Article Extraction & Reader Formatting Engine", () => {
  it("extracts structured article content while stripping junk scripts, nav, and ads", () => {
    const rawHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Designing Resilient Edge Systems</title>
          <meta property="og:title" content="Designing Resilient Edge Systems" />
          <meta name="author" content="Belal Waheed" />
          <meta property="article:published_time" content="2026-11-04T12:00:00Z" />
        </head>
        <body>
          <header><nav><a href="/">Home</a><a href="/login">Login</a></nav></header>
          <div class="cookie-banner">Accept all cookies</div>
          <article>
            <h1>Designing Resilient Edge Systems</h1>
            <p>Edge workers require deterministic isolation and fast cold-start performance.</p>
            <div class="ad">Buy our sponsored product!</div>
            <h2>Distributed Synchronization</h2>
            <p>Using local-first storage with Dexie gives users immediate sub-millisecond responsiveness.</p>
            <blockquote>Always prefer durable event logs over ephemeral state.</blockquote>
          </article>
          <aside class="sidebar">Related links and advertisements</aside>
          <footer>Copyright 2026 Markbel</footer>
        </body>
      </html>
    `;

    const result = extractArticleContentFromHtml(rawHtml);

    expect(result.title).toBe("Designing Resilient Edge Systems");
    expect(result.author).toBe("Belal Waheed");
    expect(result.publishedAt).toBe("2026-11-04T12:00:00Z");

    // Must include main content
    expect(result.content).toContain("<p>Edge workers require deterministic isolation");
    expect(result.content).toContain("<h2>Distributed Synchronization</h2>");
    expect(result.content).toContain("<blockquote><p>Always prefer durable event logs");

    // Must strip navigation, footer, and ads
    expect(result.content).not.toContain("Accept all cookies");
    expect(result.content).not.toContain("Buy our sponsored product!");
    expect(result.content).not.toContain("Related links and advertisements");
    expect(result.content).not.toContain("Copyright 2026 Markbel");

    // Metrics calculation
    expect(result.wordCount).toBeGreaterThan(20);
    expect(result.readingTime).toBe(1);
  });

  it("calculates readingTime correctly based on word count (ceil(words / 200))", () => {
    // 500 words -> ceil(500 / 200) = 3 min
    const words500 = new Array(500).fill("word").join(" ");
    const html500 = `<article><p>${words500}</p></article>`;
    const res500 = extractArticleContentFromHtml(html500);

    expect(res500.wordCount).toBe(500);
    expect(res500.readingTime).toBe(3);

    // 50 words -> Math.max(1, ceil(50 / 200)) = 1 min
    const words50 = new Array(50).fill("word").join(" ");
    const html50 = `<article><p>${words50}</p></article>`;
    const res50 = extractArticleContentFromHtml(html50);

    expect(res50.wordCount).toBe(50);
    expect(res50.readingTime).toBe(1);
  });
});
