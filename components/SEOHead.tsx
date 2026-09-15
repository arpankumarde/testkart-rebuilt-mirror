import React from 'react';
import { Helmet } from 'react-helmet';
import { useLocation } from 'react-router-dom';
import { BRAND_OG_IMAGE } from '../helpers/brandAssets';

const DEFAULT_IMAGE_URL = BRAND_OG_IMAGE;
const SITE_NAME = 'Testkart';
const SITE_ORIGIN = 'https://testkart.in';

/**
 * Canonical and og:url must always point at the official domain, so we keep
 * only the path from whatever the page supplies (absolute or relative) and
 * re-anchor it to SITE_ORIGIN. Without this the tag echoes back whichever host
 * served the page — a preview/sandbox domain, www., or a legacy domain — and
 * splits indexing away from testkart.in.
 */
const toCanonicalUrl = (url: string | undefined, pathname: string): string => {
  try {
    const parsed = new URL(url ?? pathname, SITE_ORIGIN);
    return `${SITE_ORIGIN}${parsed.pathname}${parsed.search}`;
  } catch {
    return `${SITE_ORIGIN}${pathname}`;
  }
};

export interface SEOHeadProps {
  /** The title of the page, used for the <title> tag and social media previews. */
  title: string;
  /** A brief description of the page, used for the meta description and social media previews. */
  description: string;
  /** The URL of the image to use for social media previews. Defaults to the Testkart logo. */
  image?: string;
  /**
   * The canonical URL of the page. Defaults to the current route. Only the
   * path is used — the origin is always https://testkart.in.
   */
  url?: string;
  /** The Open Graph type of the content. Defaults to "website". */
  type?: 'website' | 'article' | 'profile';
  /**
   * Set true to render `<meta name="robots" content="noindex,follow">`
   * instead of `index,follow`. Used by UGC detail pages (mock tests, study
   * notes, courses, bundles) whose indexability is computed server-side by
   * helpers/seoIndexability.tsx — thin/incomplete/unpublished content stays
   * crawlable (follow) but out of the index (noindex) until it clears the
   * quality bar. Defaults to false (index,follow), matching prior behavior
   * for every page that doesn't pass this prop.
   */
  noIndex?: boolean;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description,
  image = DEFAULT_IMAGE_URL,
  url,
  type = 'website',
  noIndex = false,
}) => {
  const location = useLocation();
  
  const finalImage = image.startsWith('data:') ? DEFAULT_IMAGE_URL : image;

  // Construct the canonical URL from the current route if not provided. Always
  // re-anchored to the official domain — see toCanonicalUrl.
  const canonicalUrl = toCanonicalUrl(url, location.pathname);

  const fullTitle = `${title} | ${SITE_NAME}`;

  return (
    <Helmet htmlAttributes={{ lang: 'en' }}>
      {/* Standard SEO */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noIndex ? 'noindex,follow' : 'index,follow'} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph (for Facebook, LinkedIn, etc.) */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={finalImage} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={finalImage} />
    </Helmet>
  );
};