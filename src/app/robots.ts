import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://polyball.xyz';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/'], // Protect admin routes from being indexed
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
