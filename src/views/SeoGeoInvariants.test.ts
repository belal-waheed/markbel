import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('SEO & Generative Engine Optimization (GEO) Invariants', () => {
  const rootDir = path.resolve(__dirname, '../../')
  const indexHtmlPath = path.join(rootDir, 'index.html')
  const robotsPath = path.join(rootDir, 'public/robots.txt')
  const sitemapPath = path.join(rootDir, 'public/sitemap.xml')
  const llmsPath = path.join(rootDir, 'public/llms.txt')
  const llmsFullPath = path.join(rootDir, 'public/llms-full.txt')

  describe('index.html Meta & Schema.org Invariants', () => {
    const html = fs.readFileSync(indexHtmlPath, 'utf-8')

    it('has a title between 20 and 60 characters for optimal SERP display', () => {
      const match = html.match(/<title>(.*?)<\/title>/)
      expect(match).not.toBeNull()
      const title = match![1]
      expect(title.length).toBeGreaterThan(20)
      expect(title.length).toBeLessThanOrEqual(60)
      expect(title).toContain('Markbel')
    })

    it('has a meta description between 70 and 155 characters', () => {
      const match = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i)
      expect(match).not.toBeNull()
      const description = match![1]
      expect(description.length).toBeGreaterThan(70)
      expect(description.length).toBeLessThanOrEqual(155)
    })

    it('does not hardcode dark mode on html tag', () => {
      expect(html).not.toMatch(/<html[^>]*class=["'][^"']*dark[^"']*["']/)
      expect(html).toContain('<html lang="en">')
    })

    it('configures canonical link and llms alternate discovery links', () => {
      expect(html).toContain('<link rel="canonical" href="https://mark.obel.workers.dev/" />')
      expect(html).toContain('href="https://mark.obel.workers.dev/llms.txt"')
      expect(html).toContain('href="https://mark.obel.workers.dev/llms-full.txt"')
      expect(html).toContain('href="https://mark.obel.workers.dev/sitemap.xml"')
    })

    it('includes valid OpenGraph and Twitter card metadata', () => {
      expect(html).toContain('property="og:title"')
      expect(html).toContain('property="og:description"')
      expect(html).toContain('property="og:image"')
      expect(html).toContain('name="twitter:card" content="summary_large_image"')
      expect(html).toContain('name="twitter:title"')
    })

    it('contains syntactically valid Schema.org JSON-LD graph with WebApplication and FAQPage', () => {
      const match = html.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/)
      expect(match).not.toBeNull()
      const jsonContent = match![1]
      const parsed = JSON.parse(jsonContent)

      expect(parsed['@context']).toBe('https://schema.org')
      expect(Array.isArray(parsed['@graph'])).toBe(true)
      expect(parsed['@graph'].length).toBeGreaterThanOrEqual(2)

      const webApp = parsed['@graph'].find((item: any) =>
        Array.isArray(item['@type'])
          ? item['@type'].includes('WebApplication')
          : item['@type'] === 'WebApplication'
      )
      expect(webApp).toBeDefined()
      expect(webApp.name).toBe('Markbel')
      expect(webApp.softwareVersion).toBe('2.5.8')
      expect(webApp.storageRequirements).toContain('Dexie.js v5')

      const faq = parsed['@graph'].find((item: any) => item['@type'] === 'FAQPage')
      expect(faq).toBeDefined()
      expect(faq.mainEntity.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('public/robots.txt Crawler Policy Invariants', () => {
    it('exists and allows standard search and AI crawlers while protecting internal endpoints', () => {
      expect(fs.existsSync(robotsPath)).toBe(true)
      const robots = fs.readFileSync(robotsPath, 'utf-8')

      // Verifies crawlers
      expect(robots).toContain('Googlebot')
      expect(robots).toContain('Bingbot')
      expect(robots).toContain('GPTBot')
      expect(robots).toContain('ClaudeBot')
      expect(robots).toContain('PerplexityBot')

      // Verifies public allowances
      expect(robots).toContain('Allow: /')
      expect(robots).toContain('Allow: /llms.txt')
      expect(robots).toContain('Allow: /llms-full.txt')

      // Verifies private disallowances
      expect(robots).toContain('Disallow: /app')
      expect(robots).toContain('Disallow: /api/')
      expect(robots).toContain('Disallow: /auth/')
      expect(robots).toContain('Disallow: /share')
      expect(robots).toContain('Disallow: /sync-debug')

      // Canonical sitemap
      expect(robots).toContain('Sitemap: https://mark.obel.workers.dev/sitemap.xml')
    })
  })

  describe('public/sitemap.xml Canonical Invariants', () => {
    it('exists, contains canonical URLs, and excludes /share', () => {
      expect(fs.existsSync(sitemapPath)).toBe(true)
      const sitemap = fs.readFileSync(sitemapPath, 'utf-8')

      expect(sitemap).toContain('<loc>https://mark.obel.workers.dev/</loc>')
      expect(sitemap).toContain('<loc>https://mark.obel.workers.dev/login</loc>')
      expect(sitemap).toContain('<loc>https://mark.obel.workers.dev/llms.txt</loc>')
      expect(sitemap).toContain('<loc>https://mark.obel.workers.dev/llms-full.txt</loc>')

      // Anti-contradiction invariant: /share must NOT be in sitemap
      expect(sitemap).not.toContain('/share')
    })
  })

  describe('public/llms.txt & public/llms-full.txt Invariants', () => {
    it('llms.txt adheres to llmstxt.org specification with required headers and links', () => {
      expect(fs.existsSync(llmsPath)).toBe(true)
      const llms = fs.readFileSync(llmsPath, 'utf-8')

      expect(llms.startsWith('# Markbel')).toBe(true)
      expect(llms).toContain('https://github.com/belal-waheed/markbel')
      expect(llms).toContain('https://mark.obel.workers.dev/llms-full.txt')
      expect(llms).toContain('Dexie.js v5')
      expect(llms).toContain('Cloudflare D1')
    })

    it('llms-full.txt documents full v2.5.8 system architecture and schemas', () => {
      expect(fs.existsSync(llmsFullPath)).toBe(true)
      const full = fs.readFileSync(llmsFullPath, 'utf-8')

      expect(full).toContain('# Markbel - Full System Specification & Architecture Manual')
      expect(full).toContain('Dexie.js v5')
      expect(full).toContain('CREATE TABLE IF NOT EXISTS bookmarks')
      expect(full).toContain('CREATE TABLE IF NOT EXISTS sync_changes')
      expect(full).toContain('/api/sync/push')
      expect(full).toContain('/api/sync/pull')
    })
  })
})
