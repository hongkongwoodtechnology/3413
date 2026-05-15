import { MetadataRoute } from 'next';
import { LANGUAGES } from '@/lib/i18n';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://polyball.xyz';

  // Base routes
  const routes = [
    '',
    '/faq',
    '/whitepaper',
    '/referral',
  ];

  const sitemapEntries: MetadataRoute.Sitemap = [];

  routes.forEach((route) => {
    // Default entry
    sitemapEntries.push({
      url: `${baseUrl}${route}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: route === '' ? 1 : 0.8,
    });

    // Add lang parameter URLs for search engines
    LANGUAGES.forEach((lang) => {
      sitemapEntries.push({
        url: `${baseUrl}/${lang.code}${route}`,
        lastModified: new Date(),
        changeFrequency: 'daily',
        priority: route === '' ? 0.9 : 0.7,
      });
    });
  });

  return sitemapEntries;
}
