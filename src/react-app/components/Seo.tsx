import { Helmet } from "react-helmet-async";

const SITE_NAME = "HireSight";
const BASE_URL = "https://hiresight.shashishanthan2706.workers.dev";
const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;
const DEFAULT_DESCRIPTION =
  "Post a job and let AI rank every applicant instantly. Share a link, collect resumes, and see a live leaderboard in minutes.";

interface SeoProps {
  title?: string;
  description?: string;
  /** Absolute URL for og:image — defaults to the landing OG image */
  image?: string;
  /** Canonical URL — defaults to BASE_URL */
  url?: string;
  /** Prevent indexing for authenticated/private routes */
  noIndex?: boolean;
}

export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_OG_IMAGE,
  url = BASE_URL,
  noIndex = false,
}: SeoProps) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — AI Resume Screener`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
}
