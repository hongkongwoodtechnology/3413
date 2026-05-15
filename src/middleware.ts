import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const locales = ['en', 'zh-TW', 'zh-CN', 'es', 'ar', 'fr', 'ru', 'de', 'ja', 'ko', 'pt', 'la', 'th'];
const defaultLocale = 'en';

function getLocale(request: NextRequest): string {
  // Check if there is any supported locale in the Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const preferredLocales = acceptLanguage.split(',').map(lang => lang.split(';')[0].trim());
    for (const locale of preferredLocales) {
      if (locale.startsWith('zh')) {
        return locale.toLowerCase() === 'zh-cn' ? 'zh-CN' : 'zh-TW';
      }
      const baseLocale = locale.split('-')[0];
      if (locales.includes(baseLocale)) {
        return baseLocale;
      }
      if (locales.includes(locale)) {
        return locale;
      }
    }
  }
  return defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Ignore files in public and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') // like favicon.ico, images, etc.
  ) {
    return NextResponse.next();
  }

  // Handle old ?lang=xxx URLs to redirect them to /[locale]
  const queryLang = searchParams.get('lang');
  if (queryLang && locales.includes(queryLang)) {
    searchParams.delete('lang');
    // We redirect to the new path with the requested locale
    // e.g. /faq?lang=zh-TW -> /zh-TW/faq
    const isRoot = pathname === '/';
    const newPathname = isRoot ? `/${queryLang}` : `/${queryLang}${pathname}`;
    const url = request.nextUrl.clone();
    url.pathname = newPathname;
    return NextResponse.redirect(url);
  }

  // Check if the pathname is missing a locale
  const pathnameIsMissingLocale = locales.every(
    (locale) => !pathname.startsWith(`/${locale}/`) && pathname !== `/${locale}`
  );

  if (pathnameIsMissingLocale) {
    const locale = getLocale(request);
    
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Matcher ignoring `/_next/` and `/api/`
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
