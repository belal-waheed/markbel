import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractMetadata,
  synthesizeMetadataFromUrl,
  cleanText,
  decodeHtmlEntities,
} from "../../worker/src/lib/metadataScraper";

describe("Metadata Scraper & Platform Adapters Suite (Modular Worker Engine)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. YouTube Adapter URL Forms", () => {
    it("handles standard youtube.com/watch?v= format", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            title: "Never Gonna Give You Up",
            author_name: "Rick Astley",
            thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const url = new URL("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Never Gonna Give You Up");
      expect(result?.description).toBe("By Rick Astley on YouTube");
      expect(result?.image).toContain("dQw4w9WgXcQ");
    });

    it("handles youtube.com/shorts/ format", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            title: "Quick Coding Tip",
            author_name: "TechCreator",
            thumbnail_url: "https://i.ytimg.com/vi/short123/hqdefault.jpg",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const url = new URL("https://www.youtube.com/shorts/short123");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Quick Coding Tip");
      expect(result?.description).toBe("By TechCreator on YouTube");
      expect(result?.image).toContain("short123");
    });

    it("handles youtu.be shortlink format", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            title: "Shortlink Video",
            author_name: "ChannelName",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const url = new URL("https://youtu.be/dQw4w9WgXcQ");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Shortlink Video");
      expect(result?.image).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    });

    it("handles youtube.com/embed/ format", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            title: "Embedded Player",
            author_name: "EmbedChannel",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const url = new URL("https://www.youtube.com/embed/dQw4w9WgXcQ");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Embedded Player");
      expect(result?.image).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    });

    it("handles youtube.com/playlist format", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            title: "TypeScript Deep Dive Playlist",
            author_name: "Instructor",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const url = new URL("https://www.youtube.com/playlist?list=PL1234567890");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("TypeScript Deep Dive Playlist");
      expect(result?.description).toBe("By Instructor on YouTube");
    });
  });

  describe("2. GitHub Repository Adapter", () => {
    it("extracts repository details and opengraph preview asset", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            description: "The library for web and native user interfaces.",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const url = new URL("https://github.com/facebook/react");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("facebook/react: The library for web and native user interfaces.");
      expect(result?.description).toBe("The library for web and native user interfaces.");
      expect(result?.image).toBe("https://opengraph.githubassets.com/1/facebook/react");
    });
  });

  describe("3. Wikipedia Article Adapter", () => {
    it("extracts summary and original image using REST API", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementationOnce(async () => {
        return new Response(
          JSON.stringify({
            title: "React (software)",
            extract: "React is a free and open-source front-end JavaScript library.",
            originalimage: {
              source: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });

      const url = new URL("https://en.wikipedia.org/wiki/React_(software)");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("React (software)");
      expect(result?.description).toContain("React is a free and open-source front-end JavaScript library.");
      expect(result?.image).toBe("https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg");
    });
  });

  describe("4. Fallback URL Metadata Synthesis", () => {
    it("synthesizes clean titles from path segments when scraping is unavailable", () => {
      const url = new URL("https://developer.mozilla.org/en-US/docs/Web/API");
      const synth = synthesizeMetadataFromUrl(url);

      expect(synth.title).toContain("En US - Docs - Web - API");
      expect(synth.title).toContain("Developer");
      expect(synth.description).toContain("developer.mozilla.org");
      expect(synth.image).toBe("");
    });

    it("synthesizes root domain titles for top-level URLs", () => {
      const url = new URL("https://example.com");
      const synth = synthesizeMetadataFromUrl(url);

      expect(synth.title).toBe("Example");
      expect(synth.description).toBe("Saved link from example.com");
      expect(synth.image).toBe("");
    });
  });

  describe("5. Text Cleaning & HTML Entity Decoding", () => {
    it("decodes HTML entities properly", () => {
      expect(decodeHtmlEntities("&amp; &quot; &lt; &gt; &#39; &#x27; &#x2F; &mdash;")).toBe(
        '& " < > \' \' / —'
      );
    });

    it("cleans excessive whitespace and decodes entities in cleanText", () => {
      expect(cleanText("  Hello &amp;    World \n\t  ")).toBe("Hello & World");
      expect(cleanText("")).toBe("");
    });
  });

  describe("6. Media Image Validation & Video Stream Resolution", () => {
    it("discards video stream manifests and segments from scraped image results", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
        const inputUrl = typeof input === "string" ? input : input.url;
        if (inputUrl.includes("api.microlink.io")) {
          return new Response(JSON.stringify({ status: "fail" }), { status: 404 });
        }
        return new Response(
          `<html><head><meta property="og:title" content="Live Stream"><meta property="og:image" content="https://example.com/live/playlist.m3u8"></head><body></body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } }
        );
      });

      const url = new URL("https://example.com/watch-live");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Live Stream");
      expect(result?.image).toBe("");
    });

    it("resolves video.vid3rb.com 302 redirect location to static jpeg thumbnail", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (input: any) => {
        const inputUrl = typeof input === "string" ? input : input.url;
        if (inputUrl.includes("video.vid3rb.com/video/")) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: "https://thumbnails.vid3rb.com/b515cf5f/thumbnail.001.jpeg",
            },
          });
        }
        return new Response(
          `<html><head><meta property="og:title" content="Anime Episode"><meta property="og:image" content="https://video.vid3rb.com/video/b515cf5f-6a75-4ee4-b6d9-cf6368d40be6"></head><body></body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } }
        );
      });

      const url = new URL("https://anime3rb.com/episode/123");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Anime Episode");
      expect(result?.image).toBe("https://thumbnails.vid3rb.com/b515cf5f/thumbnail.001.jpeg");
    });

    it("extracts Anime3rb JSON-LD partOfSeries.image and DOM poster fallback", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return new Response(
          `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"TVEpisode","name":"Frieren Ep 1","partOfSeries":{"@type":"TVSeries","image":"https://images.anime3rb.com/titles/frieren.webp"}}</script></head><body></body></html>`,
          { status: 200, headers: { "Content-Type": "text/html" } }
        );
      });

      const url = new URL("https://anime3rb.com/episode/sousou-no-frieren/1");
      const result = await extractMetadata(url);

      expect(result).not.toBeNull();
      expect(result?.title).toBe("Frieren Ep 1");
      expect(result?.image).toBe("https://images.anime3rb.com/titles/frieren.webp");
    });
  });
});
