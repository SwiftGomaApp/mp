import type { Metadata } from "next";
import { siteConfig } from "@/lib/site";

interface PageSeo {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}

// A page's openGraph/twitter replace the root ones instead of merging, so they are rebuilt here.
export function pageMetadata({ title, description, path, index = true }: PageSeo): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    robots: { index, follow: true },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      locale: siteConfig.locale,
      url: path,
      title: `${title} | ${siteConfig.shortName}`,
      description,
      images: [
        {
          url: siteConfig.logo,
          width: 512,
          height: 512,
          alt: `Logo ${siteConfig.name}`,
        },
      ],
    },
    twitter: {
      card: "summary",
      title: `${title} | ${siteConfig.shortName}`,
      description,
      images: [siteConfig.logo],
    },
  };
}
