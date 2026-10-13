import type { MetadataRoute } from "next";

// Search engines may index the store; AI and data crawlers that copy catalogs may not.
// (The proxy also blocks known copying tools and rate-limits the catalog.)
const BLOCKED_BOTS = ["GPTBot", "ChatGPT-User", "CCBot", "ClaudeBot", "anthropic-ai", "Google-Extended", "Bytespider", "PetalBot", "Amazonbot", "Diffbot", "DataForSeoBot", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot", "BLEXBot", "ImagesiftBot", "Omgilibot", "PerplexityBot", "Applebot-Extended", "meta-externalagent"];

export default function robots(): MetadataRoute.Robots {
  const site = process.env.SITE_URL?.replace(/\/+$/, "");
  return {
    rules: [
      { userAgent: BLOCKED_BOTS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/img/", "/cart", "/checkout", "/account", "/track", "/quotation", "/quote-request/sent", "/shop?*"] },
    ],
    ...(site ? { sitemap: `${site}/sitemap.xml` } : {}),
  };
}
