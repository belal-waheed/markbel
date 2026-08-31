import { Router } from 'express';
import * as cheerio from 'cheerio';

const router = Router();

function cleanHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

router.get('/', async (req, res) => {
  const rawUrl = (req.query.url as string || '').trim();
  
  if (!rawUrl) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }
  
  let targetUrl: URL;
  try {
    const formattedUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://') 
      ? rawUrl 
      : `https://${rawUrl}`;
    targetUrl = new URL(formattedUrl);
  } catch (err) {
    res.status(400).json({ error: 'Invalid URL format' });
    return;
  }

  const hostname = targetUrl.hostname.toLowerCase();

  // 1. YouTube Adapter (Videos, Shorts, Embeds)
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    let ytId: string | null = null;
    if (targetUrl.pathname.startsWith('/shorts/')) {
      ytId = targetUrl.pathname.split('/')[2]?.split('?')[0] || null;
    } else if (targetUrl.pathname.startsWith('/watch')) {
      ytId = targetUrl.searchParams.get('v');
    } else if (targetUrl.pathname.startsWith('/embed/')) {
      ytId = targetUrl.pathname.split('/')[2]?.split('?')[0] || null;
    } else if (hostname.includes('youtu.be')) {
      ytId = targetUrl.pathname.slice(1).split('/')[0]?.split('?')[0] || null;
    }

    if (ytId) {
      const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      let ytTitle = targetUrl.pathname.startsWith('/shorts/') ? 'YouTube Short' : 'YouTube Video';
      let ytAuthor = '';

      try {
        const oembedRes = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (oembedRes.ok) {
          const oembedData: any = await oembedRes.json();
          if (oembedData.title) ytTitle = oembedData.title;
          if (oembedData.author_name) ytAuthor = oembedData.author_name;
        }
      } catch {}

      res.json({
        title: cleanHtmlEntities(ytTitle),
        description: ytAuthor ? `By ${ytAuthor}` : '',
        image: thumbnail,
      });
      return;
    }
  }

  // 2. TikTok Adapter
  if (hostname.includes('tiktok.com')) {
    try {
      const oembedRes = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl.toString())}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (oembedRes.ok) {
        const oembedData: any = await oembedRes.json();
        res.json({
          title: cleanHtmlEntities(oembedData.title || `TikTok by @${oembedData.author_unique_id || oembedData.author_name}`),
          description: oembedData.author_name ? `@${oembedData.author_unique_id || oembedData.author_name} on TikTok` : 'TikTok Video',
          image: oembedData.thumbnail_url || '',
        });
        return;
      }
    } catch {}
  }

  // 3. Twitter / X Adapter
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    try {
      const oembedRes = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(targetUrl.toString())}&omit_script=true`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (oembedRes.ok) {
        const oembedData: any = await oembedRes.json();
        const plainText = (oembedData.html || '').replace(/<[^>]*>?/gm, '').trim();
        res.json({
          title: oembedData.author_name ? `Post by ${oembedData.author_name}` : 'Post on X',
          description: cleanHtmlEntities(plainText).slice(0, 200),
          image: '',
        });
        return;
      }
    } catch {}
  }

  // 4. Standard OpenGraph Fallback
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    let userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    if (hostname.includes('instagram.com') || hostname.includes('facebook.com')) {
      userAgent = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_codedoc.html)';
    }

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
      redirect: 'follow'
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const htmlTitle = $('title').first().text();
    
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const twitterDesc = $('meta[name="twitter:description"]').attr('content');
    const htmlMetaDesc = $('meta[name="description"]').attr('content');

    let ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[property="og:image:secure_url"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('meta[name="twitter:image:src"]').attr('content') ||
      $('link[rel="image_src"]').attr('href');

    const rawTitle = ogTitle || twitterTitle || htmlTitle || targetUrl.hostname;
    const rawDescription = ogDesc || twitterDesc || htmlMetaDesc || '';
    let image = ogImage || '';

    // Handle relative images
    if (image && !image.startsWith('http')) {
      try {
        image = new URL(image, targetUrl.origin).toString();
      } catch {}
    }

    res.json({
      title: cleanHtmlEntities(rawTitle),
      description: cleanHtmlEntities(rawDescription),
      image: image.trim()
    });

  } catch (err: any) {
    res.json({
      title: targetUrl.hostname.replace(/^www\./, ''),
      description: '',
      image: ''
    });
  }
});

export default router;

