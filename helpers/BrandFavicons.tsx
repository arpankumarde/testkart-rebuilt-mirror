import { Helmet } from "react-helmet";

// Favicon set served from the app's own domain (Floot storage), generated from
// the brand mark at sizes Google Search accepts (multiples of 48px). Keep these
// URLs stable: Google caches the favicon per hostname and refreshes it slowly.
const FAVICON_ICO = "/_cdn/static/3dabc7d2-3334-4994-8583-360fd9f9f586-favicon.ico";
const FAVICON_48 = "/_cdn/static/16f4a9cc-157b-4941-b8b1-6196c49c5201-favicon-48x48.png";
const FAVICON_96 = "/_cdn/static/64a4c812-1010-4a6a-a6ea-5427277beb87-favicon-96x96.png";
const FAVICON_192 = "/_cdn/static/2bddf99f-f02a-466e-b554-658e4e194150-favicon-192x192.png";
const APPLE_TOUCH_ICON = "/_cdn/static/ace72303-e46f-4365-bf2d-a965525b41ca-apple-touch-icon.png";

export const BrandFavicons = () => (
  <Helmet>
    <link rel="icon" type="image/png" sizes="48x48" href={FAVICON_48} />
    <link rel="icon" type="image/png" sizes="96x96" href={FAVICON_96} />
    <link rel="icon" type="image/png" sizes="192x192" href={FAVICON_192} />
    <link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href={FAVICON_ICO} />
    <link rel="apple-touch-icon" sizes="180x180" href={APPLE_TOUCH_ICON} />
  </Helmet>
);
