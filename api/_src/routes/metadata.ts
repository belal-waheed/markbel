import { Router } from 'express';
import { MetadataService, SSRFValidationError } from '../services/MetadataService.js';

const router = Router();

router.get('/', async (req, res) => {
  const rawUrl = (req.query.url as string || '').trim();
  const includeArticle = req.query.article === '1' || req.query.article === 'true';

  if (!rawUrl) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    const metadata = await MetadataService.extractMetadata(rawUrl, {
      timeoutMs: 6000,
      includeArticleContent: includeArticle,
    });

    res.json(metadata);
  } catch (err: any) {
    if (err instanceof SSRFValidationError) {
      res.status(403).json({ error: err.message });
      return;
    }

    res.status(500).json({
      error: 'Failed to extract metadata',
      details: err?.message || String(err),
    });
  }
});

export default router;

