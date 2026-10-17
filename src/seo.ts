/**
 * SEO, Performance, Schema Markup & Meta Tag Utilities for Lumen
 */

export interface SeoMetadataOptions {
  title?: string
  description?: string
  path?: string
  canonicalUrl?: string
  isNoIndex?: boolean
  ogImage?: string
  ogType?: 'website' | 'video.movie' | 'video.tv_show'
  movie?: {
    id?: string
    title?: string
    synopsis?: string
    year?: string
    type?: string
    poster?: string
    hero?: string
    still?: string
    genres?: string[]
    rating?: string
  } | null
}

export const DEFAULT_SITE_TITLE = 'Lumen — Stream Movies, TV Shows, Anime & Live TV'
export const DEFAULT_SITE_DESCRIPTION =
  'Stream thousands of trending movies, hit TV series, anime, manga, and live sports in high-definition on Lumen with an ultra-fast Apple TV and Netflix inspired interface.'
export const DEFAULT_SITE_ORIGIN = 'https://lumen.tv'
export const DEFAULT_OG_IMAGE = 'https://lumen.tv/og-image.jpg'

/**
 * Clean up title or string into a URL-friendly slug
 * - Normalizes Unicode diacritics
 * - Removes illegal special characters
 * - Collapses consecutive hyphens
 * - Trims hyphens from ends
 */
export function slugify(text: string): string {
  if (!text) return ''
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // remove accent marks
    .toLowerCase()
    .trim()
    .replace(/[''""`]/g, '') // remove apostrophes & quotes
    .replace(/[^a-z0-9\s-]/g, ' ') // replace punctuation with spaces
    .replace(/[\s_]+/g, '-') // replace whitespace & underscores with hyphen
    .replace(/-+/g, '-') // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '') // trim hyphens from ends
}

/**
 * Creates a clean movie URL slug e.g. "inception-2010"
 */
export function createMovieSlug(title: string, year?: string): string {
  const baseSlug = slugify(title)
  if (year && /^\d{4}$/.test(year.trim()) && !baseSlug.endsWith(year.trim())) {
    return `${baseSlug}-${year.trim()}`
  }
  return baseSlug
}

/**
 * Enforces HTTPS for absolute URLs (prevents mixed content warnings)
 */
export function enforceHttpsUrl(url: string): string {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (trimmed.startsWith('http://localhost') || trimmed.startsWith('http://127.0.0.1')) {
    return trimmed
  }
  return trimmed.replace(/^http:\/\//i, 'https://')
}

/**
 * Builds a clean canonical URL for a path or hash
 * Strips sensitive query params (token, pin, secret, password)
 */
export function buildCanonicalUrl(pathOrHash = '', origin = DEFAULT_SITE_ORIGIN): string {
  const safeOrigin = enforceHttpsUrl(origin).replace(/\/+$/, '')
  let cleanPath = (pathOrHash || '').trim()

  // Remove leading slashes and hash characters e.g. "/#movies", "#movies" -> "movies"
  cleanPath = cleanPath.replace(/^[/\\#]+/, '')

  // Remove sensitive tokens/query parameters from canonical URL
  if (cleanPath.includes('?')) {
    const [pathPart, queryPart] = cleanPath.split('?')
    const params = new URLSearchParams(queryPart)
    params.delete('token')
    params.delete('pin')
    params.delete('secret')
    params.delete('password')
    params.delete('code')
    const cleanedParams = params.toString()
    cleanPath = cleanedParams ? `${pathPart}?${cleanedParams}` : pathPart
  }

  // Normalize leading slash
  if (cleanPath.length > 0) {
    cleanPath = `/${cleanPath}`
  } else {
    cleanPath = '/'
  }

  // Avoid trailing slash on non-root URLs
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1)
  }

  return `${safeOrigin}${cleanPath}`
}

/**
 * Generate Schema.org JSON-LD for WebSite and Organization
 */
export function generateWebSiteSchema(origin = DEFAULT_SITE_ORIGIN) {
  const safeOrigin = enforceHttpsUrl(origin)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${safeOrigin}/#organization`,
        name: 'Lumen',
        url: safeOrigin,
        logo: {
          '@type': 'ImageObject',
          url: `${safeOrigin}/lumen-logo.png`,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${safeOrigin}/#website`,
        url: safeOrigin,
        name: 'Lumen',
        description: DEFAULT_SITE_DESCRIPTION,
        publisher: {
          '@id': `${safeOrigin}/#organization`,
        },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${safeOrigin}/#search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

/**
 * Generate Schema.org JSON-LD for Movie or TVSeries
 */
export function generateMediaSchema(
  movie: NonNullable<SeoMetadataOptions['movie']>,
  origin = DEFAULT_SITE_ORIGIN,
) {
  const isTv =
    movie.type?.toLowerCase().includes('tv') ||
    movie.type?.toLowerCase().includes('series') ||
    movie.type?.toLowerCase().includes('show')
  const schemaType = isTv ? 'TVSeries' : 'Movie'
  const imageUrl = enforceHttpsUrl(movie.poster || movie.hero || movie.still || `${origin}/og-image.jpg`)
  const slug = createMovieSlug(movie.title || 'watch', movie.year)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: movie.title || 'Untitled',
    description: movie.synopsis || DEFAULT_SITE_DESCRIPTION,
    image: imageUrl,
    url: `${origin}/#detail/${slug}`,
  }

  if (movie.year && /^\d{4}$/.test(movie.year.trim())) {
    schema.datePublished = `${movie.year.trim()}-01-01`
  }

  if (Array.isArray(movie.genres) && movie.genres.length > 0) {
    schema.genre = movie.genres
  }

  if (movie.rating && !isNaN(parseFloat(movie.rating))) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: parseFloat(movie.rating),
      bestRating: 10,
      worstRating: 1,
      ratingCount: 100,
    }
  }

  return schema
}

/**
 * Helper to get or create a DOM head element
 */
function getOrCreateTag<T extends HTMLElement>(
  selector: string,
  tagName: string,
  parent: HTMLElement = document.head,
): T {
  let el = parent.querySelector(selector) as T | null
  if (!el) {
    el = document.createElement(tagName) as T
    parent.appendChild(el)
  }
  return el
}

/**
 * Updates document head SEO tags dynamically
 */
export function updateSeoTags(options: SeoMetadataOptions): void {
  if (typeof document === 'undefined') return

  const origin =
    typeof window !== 'undefined' &&
    window.location?.origin &&
    !window.location.origin.includes('localhost') &&
    !window.location.origin.includes('127.0.0.1')
      ? enforceHttpsUrl(window.location.origin)
      : DEFAULT_SITE_ORIGIN

  // 1. Meta Title
  const title = options.title ? `${options.title} | Lumen` : DEFAULT_SITE_TITLE
  document.title = title

  // 2. Meta Description
  const description = options.description || DEFAULT_SITE_DESCRIPTION
  const descMeta = getOrCreateTag<HTMLMetaElement>('meta[name="description"]', 'meta')
  descMeta.name = 'description'
  descMeta.content = description

  // 3. Robots Meta Tag (No-index for adult/sensitive profiles)
  const robotsMeta = getOrCreateTag<HTMLMetaElement>('meta[name="robots"]', 'meta')
  robotsMeta.name = 'robots'
  if (options.isNoIndex) {
    robotsMeta.content = 'noindex, nofollow, noarchive'
  } else {
    robotsMeta.content = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
  }

  // 4. Canonical Tag
  const canonicalUrl = options.canonicalUrl || buildCanonicalUrl(options.path || '', origin)
  const canonicalLink = getOrCreateTag<HTMLLinkElement>('link[rel="canonical"]', 'link')
  canonicalLink.rel = 'canonical'
  canonicalLink.href = canonicalUrl

  // 5. Open Graph Meta Tags
  const ogTitle = getOrCreateTag<HTMLMetaElement>('meta[property="og:title"]', 'meta')
  ogTitle.setAttribute('property', 'og:title')
  ogTitle.content = title

  const ogDesc = getOrCreateTag<HTMLMetaElement>('meta[property="og:description"]', 'meta')
  ogDesc.setAttribute('property', 'og:description')
  ogDesc.content = description

  const ogUrl = getOrCreateTag<HTMLMetaElement>('meta[property="og:url"]', 'meta')
  ogUrl.setAttribute('property', 'og:url')
  ogUrl.content = canonicalUrl

  const ogType = getOrCreateTag<HTMLMetaElement>('meta[property="og:type"]', 'meta')
  ogType.setAttribute('property', 'og:type')
  ogType.content = options.ogType || 'website'

  const ogSiteName = getOrCreateTag<HTMLMetaElement>('meta[property="og:site_name"]', 'meta')
  ogSiteName.setAttribute('property', 'og:site_name')
  ogSiteName.content = 'Lumen'

  const ogImg = getOrCreateTag<HTMLMetaElement>('meta[property="og:image"]', 'meta')
  ogImg.setAttribute('property', 'og:image')
  ogImg.content = options.ogImage || `${origin}/og-image.jpg`

  // 6. Twitter Card Meta Tags
  const twCard = getOrCreateTag<HTMLMetaElement>('meta[name="twitter:card"]', 'meta')
  twCard.name = 'twitter:card'
  twCard.content = 'summary_large_image'

  const twTitle = getOrCreateTag<HTMLMetaElement>('meta[name="twitter:title"]', 'meta')
  twTitle.name = 'twitter:title'
  twTitle.content = title

  const twDesc = getOrCreateTag<HTMLMetaElement>('meta[name="twitter:description"]', 'meta')
  twDesc.name = 'twitter:description'
  twDesc.content = description

  const twImg = getOrCreateTag<HTMLMetaElement>('meta[name="twitter:image"]', 'meta')
  twImg.name = 'twitter:image'
  twImg.content = options.ogImage || `${origin}/og-image.jpg`

  // 7. Dynamic JSON-LD Schema Markup
  let schemaScript = document.getElementById('lumen-jsonld-schema') as HTMLScriptElement | null
  if (!schemaScript) {
    schemaScript = document.createElement('script')
    schemaScript.id = 'lumen-jsonld-schema'
    schemaScript.type = 'application/ld+json'
    document.head.appendChild(schemaScript)
  }

  if (options.movie) {
    schemaScript.textContent = JSON.stringify(generateMediaSchema(options.movie, origin))
  } else {
    schemaScript.textContent = JSON.stringify(generateWebSiteSchema(origin))
  }
}
