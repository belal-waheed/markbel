import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as cheerio from 'cheerio';

const router = Router();

function extractYouTubeVideoId(url: URL): string | null {
  if (url.hostname.includes('youtu.be')) {
    return url.pathname.replace(/^\//, '').split(/[?#]/)[0] || null;
  }
  if (url.hostname.includes('youtube.com')) {
    return url.searchParams.get('v') || null;
  }
  return null;
}

function cleanHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

router.get('/', authMiddleware, async (req, res) => {
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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000); // 7 second bounded timeout

    const response = await fetch(targetUrl.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      res.json({
        title: targetUrl.hostname,
        description: `Resource type: ${contentType}`,
        image: contentType.startsWith('image/') ? targetUrl.toString() : ''
      });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const htmlTitle = $('title').first().text();
    
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const twitterDesc = $('meta[name="twitter:description"]').attr('content');
    const htmlMetaDesc = $('meta[name="description"]').attr('content');

    let ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');

    // YouTube specific optimization
    const ytVideoId = extractYouTubeVideoId(targetUrl);
    let ytTitle = '';
    if (ytVideoId) {
      ytTitle = $('meta[name="title"]').attr('content') || '';
      if (!ogImage) {
        ogImage = `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`;
      }
    }

    const rawTitle = ytTitle || ogTitle || twitterTitle || htmlTitle || targetUrl.hostname;
    const rawDescription = ogDesc || twitterDesc || htmlMetaDesc || '';
    let image = ogImage || '';

    // Handle relative images
    if (image && !image.startsWith('http')) {
      if (image.startsWith('//')) {
        image = `${targetUrl.protocol}${image}`;
      } else if (image.startsWith('/')) {
        image = `${targetUrl.protocol}//${targetUrl.host}${image}`;
      } else {
        image = `${targetUrl.protocol}//${targetUrl.host}/${image}`;
      }
    }

    res.json({
      title: cleanHtmlEntities(rawTitle),
      description: cleanHtmlEntities(rawDescription),
      image: image.trim()
    });

  } catch (err: any) {
    // Graceful fallback on network failure / timeout
    const ytVideoId = extractYouTubeVideoId(targetUrl);
    const fallbackImage = ytVideoId ? `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg` : '';

    res.json({
      title: targetUrl.hostname.replace(/^www\./, ''),
      description: '',
      image: fallbackImage
    });
  }
});

export default router;
