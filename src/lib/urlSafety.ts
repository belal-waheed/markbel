/**
 * Markbel URL Safety & SSRF Protection Utilities
 * Canonicalized security validations for URL fetching and sanitization.
 */

export class SSRFValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SSRFValidationError';
  }
}

/**
 * Validates whether a target URL is safe to fetch (blocks SSRF, loopbacks, link-local metadata, and private CIDR ranges).
 */
export function isSafePublicUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'http:' && protocol !== 'https:') {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Block localhost, loopback, and zero addresses
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname === '0:0:0:0:0:0:0:0' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal')
    ) {
      return false;
    }

    // Block cloud metadata services (AWS, GCP, Azure, DigitalOcean)
    if (hostname === '169.254.169.254' || hostname === 'metadata.google.internal') {
      return false;
    }

    // Check IPv4 private and link-local ranges
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipMatch = hostname.match(ipv4Regex);
    if (ipMatch) {
      const octets = [
        parseInt(ipMatch[1], 10),
        parseInt(ipMatch[2], 10),
        parseInt(ipMatch[3], 10),
        parseInt(ipMatch[4], 10),
      ];

      // 10.0.0.0/8
      if (octets[0] === 10) return false;
      // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return false;
      // 192.168.0.0/16
      if (octets[0] === 192 && octets[1] === 168) return false;
      // 127.0.0.0/8 (Loopback)
      if (octets[0] === 127) return false;
      // 169.254.0.0/16 (Link-local)
      if (octets[0] === 169 && octets[1] === 254) return false;
      // 0.0.0.0/8
      if (octets[0] === 0) return false;
    }

    // Block IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
    if (hostname.startsWith('::ffff:')) {
      const rest = hostname.slice(7);
      if (rest.includes('.')) {
        return isSafePublicUrl(`http://${rest}`);
      }
      const parts = rest.split(':');
      if (parts.length === 2) {
        const high = parseInt(parts[0], 16);
        const low = parseInt(parts[1], 16);
        if (!isNaN(high) && !isNaN(low)) {
          const o1 = (high >> 8) & 0xff;
          const o2 = high & 0xff;
          const o3 = (low >> 8) & 0xff;
          const o4 = low & 0xff;
          return isSafePublicUrl(`http://${o1}.${o2}.${o3}.${o4}`);
        }
      }
      return false;
    }

    // Block IPv6 private ranges (fc00::/7, fe80::/10)
    if (hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe80:')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Removes tracking parameters (UTM, fbclid, gclid, etc.) from a URL while preserving core content parameters.
 */
export function sanitizeAndCleanUrl(rawUrl: string): { targetUrl: URL; cleanUrlStr: string } {
  let formatted = rawUrl.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `https://${formatted}`;
  }

  const targetUrl = new URL(formatted);

  const TRACKING_PARAMS = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_term',
    'utm_content',
    'utm_id',
    'fbclid',
    'gclid',
    'gclsrc',
    'dclid',
    'wbraid',
    'gbraid',
    'igshid',
    'mc_cid',
    'mc_eid',
    'msclkid',
    'twclid',
    '_hsenc',
    '_hsmi',
    'mkt_tok',
    'vero_id',
  ];

  for (const param of TRACKING_PARAMS) {
    targetUrl.searchParams.delete(param);
  }

  // Also remove YouTube tracking if present but keep video id
  if (
    targetUrl.hostname.includes('youtube.com') ||
    targetUrl.hostname.includes('youtu.be')
  ) {
    targetUrl.searchParams.delete('si');
    targetUrl.searchParams.delete('feature');
    targetUrl.searchParams.delete('pp');
  }

  return {
    targetUrl,
    cleanUrlStr: targetUrl.toString(),
  };
}

/**
 * Cleans escaped HTML entities and normalizes whitespace.
 */
export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') return '';
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
