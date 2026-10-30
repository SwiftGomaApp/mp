import type { MetadataRoute } from "next";
import { legalDocuments, legalPath } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const legalPages = legalDocuments.map((document) => ({
    url: `${siteConfig.url}${legalPath(document.slug)}`,
    changeFrequency: "yearly" as const,
    priority: 0.3,
  }));

  return [
    {
      url: siteConfig.url,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/auth/sign-up`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    ...legalPages,
  ];
}
