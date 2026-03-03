import { Helmet } from 'react-helmet-async';

const SITE_URL = 'https://uhm-chat.ermis.network';
const DEFAULT_TITLE = 'Uhmm...! - Secure Chat & Messaging App';
const DEFAULT_DESCRIPTION =
  'Uhmm...! - A modern, secure chat app that connects people quickly and easily. Send messages, make calls, and share files with end-to-end encryption.';
const DEFAULT_IMAGE = `${SITE_URL}/uhm-preview.png`;

/**
 * SEOHead - Reusable component for per-page SEO meta tags
 * @param {string} title - Page title (appended to site name)
 * @param {string} description - Page meta description
 * @param {string} path - Page path (e.g. '/login')
 * @param {boolean} noIndex - If true, tells search engines not to index this page
 */
export default function SEOHead({ title, description, path = '', noIndex = false }) {
  const fullTitle = title ? `${title} | Uhmm...!` : DEFAULT_TITLE;
  const fullDescription = description || DEFAULT_DESCRIPTION;
  const canonicalUrl = `${SITE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={fullDescription} />
      <link rel="canonical" href={canonicalUrl} />

      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={fullDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={DEFAULT_IMAGE} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Uhmm...!" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={fullDescription} />
      <meta name="twitter:image" content={DEFAULT_IMAGE} />
    </Helmet>
  );
}
