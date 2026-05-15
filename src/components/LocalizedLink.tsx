"use client";

import Link, { LinkProps } from "next/link";
import { useLanguage } from "./LanguageProvider";
import React, { AnchorHTMLAttributes } from "react";
import { UrlObject } from "url";

type LocalizedLinkProps = LinkProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export function LocalizedLink({ href, ...props }: LocalizedLinkProps) {
  const { language } = useLanguage();
  
  // If href is a string and starts with /, prepend the language
  let localizedHref = href;
  if (typeof href === "string" && href.startsWith("/")) {
    localizedHref = `/${language}${href === "/" ? "" : href}`;
  } else if (typeof href === "object" && href !== null) {
    const urlObj = href as UrlObject;
    if (urlObj.pathname && urlObj.pathname.startsWith("/")) {
      localizedHref = {
        ...urlObj,
        pathname: `/${language}${urlObj.pathname === "/" ? "" : urlObj.pathname}`
      };
    }
  }

  return <Link href={localizedHref} {...props} />;
}
