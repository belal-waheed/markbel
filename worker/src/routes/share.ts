import { Hono } from "hono";
import type { Bindings, Variables } from "../types";

export const shareRouter = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PWA SHARE TARGET ROUTE HANDLERS (/share)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Handle POST from legacy or cached WebAPK manifests (multipart/form-data, x-www-form-urlencoded, json)
shareRouter.post("/share", async (c) => {
  let title = "";
  let text = "";
  let url = "";

  const contentType = c.req.header("content-type") || "";

  try {
    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await c.req.formData();
      title = (formData.get("title") as string) || "";
      text = (formData.get("text") as string) || "";
      url = (formData.get("url") as string) || "";
    } else if (contentType.includes("application/json")) {
      const body: any = await c.req.json().catch(() => ({}));
      title = body.title || "";
      text = body.text || "";
      url = body.url || "";
    } else {
      const rawText = await c.req.text().catch(() => "");
      text = rawText;
    }
  } catch (err) {
    console.error("[Share Target POST Parse Error]:", err);
  }

  // Extract URL from text if url parameter is empty (standard in Instagram Reel, TikTok, Twitter share intents)
  let targetUrl = url.trim();
  if (!targetUrl && text) {
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
      targetUrl = urlMatch[0];
    }
  }

  // Clean trailing punctuation or brackets often attached to URLs in share intents
  if (targetUrl) {
    targetUrl = targetUrl.replace(/[),.;]+$/, "");
  }

  const queryParams = new URLSearchParams();
  if (targetUrl) queryParams.set("url", targetUrl);
  if (title) queryParams.set("title", title);
  if (text) queryParams.set("text", text);

  const queryString = queryParams.toString();
  const redirectUrl = queryString ? `/share?${queryString}` : "/share";

  // HTTP 303 See Other redirects client to GET /share with query parameters
  return c.redirect(redirectUrl, 303);
});

// Handle GET /share explicitly
shareRouter.get("/share", async (c) => {
  if (c.env.ASSETS) {
    return await c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Markbel Share Target", 200);
});
