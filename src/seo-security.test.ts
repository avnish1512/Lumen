import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  slugify,
  createMovieSlug,
  enforceHttpsUrl,
  buildCanonicalUrl,
  generateWebSiteSchema,
  generateMediaSchema,
  updateSeoTags,
  DEFAULT_SITE_TITLE,
  DEFAULT_SITE_DESCRIPTION,
} from './seo'

describe('SEO & Security: Checklist Verification', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  describe('1. Robots & No-Index Tags', () => {
    it('sets index, follow for mainstream discovery routes', () => {
      updateSeoTags({ title: 'Movies', path: '/#movies', isNoIndex: false })
      const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement
      expect(robots).not.toBeNull()
      expect(robots.content).toContain('index')
      expect(robots.content).toContain('follow')
      expect(robots.content).not.toContain('noindex')
    })

    it('sets noindex, nofollow, noarchive for Lord adult routes or sensitive screens', () => {
      updateSeoTags({ title: 'Protected Entertainment', path: '/#lord', isNoIndex: true })
      const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement
      expect(robots).not.toBeNull()
      expect(robots.content).toBe('noindex, nofollow, noarchive')
    })

    it('sets noindex for account settings and login screens', () => {
      updateSeoTags({ title: 'Account Settings', path: '/#account', isNoIndex: true })
      const robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement
      expect(robots.content).toContain('noindex')
    })
  })

  describe('2. Meta Titles & 3. Meta Descriptions', () => {
    it('sets default meta title and description when omitted', () => {
      updateSeoTags({})
      expect(document.title).toBe(DEFAULT_SITE_TITLE)
      const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement
      expect(desc.content).toBe(DEFAULT_SITE_DESCRIPTION)
    })

    it('dynamically formats movie title with branding', () => {
      updateSeoTags({
        title: 'Inception (2010) — Watch Online',
        description: 'A thief who steals corporate secrets through dream-sharing technology.',
      })
      expect(document.title).toBe('Inception (2010) — Watch Online | Lumen')
      const desc = document.querySelector('meta[name="description"]') as HTMLMetaElement
      expect(desc.content).toBe('A thief who steals corporate secrets through dream-sharing technology.')
    })
  })

  describe('4. Image Alt Text & Image Optimization', () => {
    it('ensures compressed icon.jpeg exists and is under 50 KB (drastic CWV optimization)', () => {
      const iconPath = path.resolve(__dirname, '../public/icon.jpeg')
      expect(fs.existsSync(iconPath)).toBe(true)
      const stats = fs.statSync(iconPath)
      // Was originally 1,445,606 bytes; should now be compressed under 50KB
      expect(stats.size).toBeLessThan(50 * 1024)
    })

    it('ensures public/og-image.jpg exists and is under 300 KB for rapid crawler delivery', () => {
      const ogPath = path.resolve(__dirname, '../public/og-image.jpg')
      expect(fs.existsSync(ogPath)).toBe(true)
      const stats = fs.statSync(ogPath)
      expect(stats.size).toBeGreaterThan(5 * 1024)
      expect(stats.size).toBeLessThan(300 * 1024)
    })
  })

  describe('5. Core Web Vitals & Resource Hints', () => {
    it('verifies index.html contains essential CDN preconnects and dns-prefetch hints', () => {
      const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8')
      expect(indexHtml).toContain('rel="preconnect" href="https://image.tmdb.org"')
      expect(indexHtml).toContain('rel="dns-prefetch" href="https://image.tmdb.org"')
      expect(indexHtml).toContain('rel="preconnect" href="https://s4.anilist.co"')
    })
  })

  describe('6. Sitemap.xml & 17. Robots.txt', () => {
    it('verifies public/robots.txt contains correct allow/disallow directives and sitemap reference', () => {
      const robotsTxt = fs.readFileSync(path.resolve(__dirname, '../public/robots.txt'), 'utf-8')
      expect(robotsTxt).toContain('User-agent: *')
      expect(robotsTxt).toContain('Allow: /')
      expect(robotsTxt).toContain('Allow: /movies')
      expect(robotsTxt).toContain('Disallow: /lord')
      expect(robotsTxt).toContain('Disallow: /admin')
      expect(robotsTxt).toContain('Disallow: /api/')
      expect(robotsTxt).toContain('Disallow: /*?*token=*')
      expect(robotsTxt).toContain('Disallow: /*?*pin=*')
      expect(robotsTxt).toContain('Sitemap: https://lumen.tv/sitemap.xml')
    })

    it('verifies public/sitemap.xml is valid XML and covers key streaming sections', () => {
      const sitemap = fs.readFileSync(path.resolve(__dirname, '../public/sitemap.xml'), 'utf-8')
      expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>')
      expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
      expect(sitemap).toContain('<loc>https://lumen.tv/</loc>')
      expect(sitemap).toContain('<loc>https://lumen.tv/movies</loc>')
      expect(sitemap).toContain('<loc>https://lumen.tv/tv</loc>')
      expect(sitemap).toContain('<loc>https://lumen.tv/anime</loc>')
      expect(sitemap).toContain('<loc>https://lumen.tv/manga</loc>')
      expect(sitemap).toContain('<loc>https://lumen.tv/livetv</loc>')
    })
  })

  describe('7. Open Graph & Twitter Cards', () => {
    it('generates complete og:image, og:title, twitter:card, and twitter:image meta tags', () => {
      updateSeoTags({
        title: 'Attack on Titan',
        description: 'Humanity fights against giant humanoids known as Titans.',
        ogImage: 'https://image.tmdb.org/t/p/w1280/titan.jpg',
        path: '/#anime',
      })

      const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement
      const ogTitle = document.querySelector('meta[property="og:title"]') as HTMLMetaElement
      const twCard = document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement
      const twImage = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement

      expect(ogImage.content).toBe('https://image.tmdb.org/t/p/w1280/titan.jpg')
      expect(ogTitle.content).toBe('Attack on Titan | Lumen')
      expect(twCard.content).toBe('summary_large_image')
      expect(twImage.content).toBe('https://image.tmdb.org/t/p/w1280/titan.jpg')
    })
  })

  describe('10. Clean URL Slugs', () => {
    it('cleans up complex titles with punctuation, diacritics, and symbols', () => {
      expect(slugify('Spider-Man: Across the Spider-Verse (2023)!')).toBe('spider-man-across-the-spider-verse-2023')
      expect(slugify("WALL·E & L'Amour: Déjà Vu")).toBe('wall-e-lamour-deja-vu')
      expect(slugify('   ---Multiple---Hyphens---   ')).toBe('multiple-hyphens')
    })

    it('creates clean movie slugs with optional year suffix', () => {
      expect(createMovieSlug('Interstellar', '2014')).toBe('interstellar-2014')
      expect(createMovieSlug('2001: A Space Odyssey', '1968')).toBe('2001-a-space-odyssey-1968')
      expect(createMovieSlug('Cyberpunk 2077', '2077')).toBe('cyberpunk-2077')
    })
  })

  describe('12. Canonical URLs & 13. HTTPS Enforcement', () => {
    it('enforces HTTPS and strips insecure http protocols', () => {
      expect(enforceHttpsUrl('http://example.com/poster.jpg')).toBe('https://example.com/poster.jpg')
      expect(enforceHttpsUrl('https://example.com/poster.jpg')).toBe('https://example.com/poster.jpg')
      expect(enforceHttpsUrl('http://localhost:3000/test')).toBe('http://localhost:3000/test')
    })

    it('builds canonical URL while stripping sensitive query tokens and pins', () => {
      const canonical = buildCanonicalUrl('#watch?id=tt1375666&token=secret123&pin=4719&season=1')
      expect(canonical).toBe('https://lumen.tv/watch?id=tt1375666&season=1')
      expect(canonical).not.toContain('token')
      expect(canonical).not.toContain('pin')
      expect(canonical.startsWith('https://')).toBe(true)
    })

    it('updates DOM link[rel="canonical"] correctly', () => {
      updateSeoTags({ path: '/#movies' })
      const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
      expect(canonical).not.toBeNull()
      expect(canonical.href).toBe('https://lumen.tv/movies')
    })
  })

  describe('15. Schema Markup (JSON-LD)', () => {
    it('generates valid WebSite and Organization schema', () => {
      const schema = generateWebSiteSchema()
      expect(schema['@context']).toBe('https://schema.org')
      expect(Array.isArray(schema['@graph'])).toBe(true)

      const org = schema['@graph'].find((item) => item['@type'] === 'Organization')
      expect(org).toBeDefined()
      expect(org?.name).toBe('Lumen')

      const site = schema['@graph'].find((item) => item['@type'] === 'WebSite')
      expect(site).toBeDefined()
      expect(site?.potentialAction).toBeDefined()
    })

    it('generates valid Movie JSON-LD schema when movie metadata is provided', () => {
      const movieSchema = generateMediaSchema({
        id: 'tt1375666',
        title: 'Inception',
        year: '2010',
        type: 'movie',
        synopsis: 'A thief enters dreams to steal secrets.',
        poster: 'https://example.com/inception.jpg',
        genres: ['Action', 'Sci-Fi'],
        rating: '8.8',
      })

      expect(movieSchema['@context']).toBe('https://schema.org')
      expect(movieSchema['@type']).toBe('Movie')
      expect(movieSchema.name).toBe('Inception')
      expect(movieSchema.datePublished).toBe('2010-01-01')
      expect(movieSchema.image).toBe('https://example.com/inception.jpg')
      expect(movieSchema.genre).toEqual(['Action', 'Sci-Fi'])
      expect((movieSchema.aggregateRating as { ratingValue: number }).ratingValue).toBe(8.8)
    })

    it('injects and updates JSON-LD script tag in document.head', () => {
      updateSeoTags({
        movie: {
          id: '123',
          title: 'Dune',
          year: '2021',
          type: 'movie',
          synopsis: 'Desert epic.',
        },
      })

      const script = document.getElementById('lumen-jsonld-schema') as HTMLScriptElement
      expect(script).not.toBeNull()
      const parsed = JSON.parse(script.textContent || '{}')
      expect(parsed['@type']).toBe('Movie')
      expect(parsed.name).toBe('Dune')
    })
  })

  describe('18. Mobile Responsiveness & Headers Security', () => {
    it('verifies index.html contains mobile responsive viewport meta tag', () => {
      const indexHtml = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8')
      expect(indexHtml).toContain('viewport-fit=cover')
      expect(indexHtml).toContain('width=device-width')
    })

    it('verifies vercel.json contains HSTS, CSP upgrade-insecure-requests, and security headers', () => {
      const vercelConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../vercel.json'), 'utf-8'))
      const mainHeaderRule = vercelConfig.headers.find((rule: { source: string }) => rule.source === '/(.*)')
      expect(mainHeaderRule).toBeDefined()

      const headersMap: Record<string, string> = {}
      for (const h of mainHeaderRule.headers) {
        headersMap[h.key] = h.value
      }

      expect(headersMap['Strict-Transport-Security']).toContain('max-age=63072000')
      expect(headersMap['X-Content-Type-Options']).toBe('nosniff')
      expect(headersMap['X-Frame-Options']).toBe('SAMEORIGIN')
      expect(headersMap['Content-Security-Policy']).toContain('upgrade-insecure-requests')
      expect(headersMap['X-DNS-Prefetch-Control']).toBe('on')
    })
  })
})
