"use client";

import { useEffect } from "react";

export default function DynamicFavicon() {
  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        const faviconUrl = data.site_favicon || data.site_logo;
        if (!faviconUrl) return;

        const link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (link) link.href = faviconUrl;

        const appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
        if (appleLink) appleLink.href = faviconUrl;
      })
      .catch(() => {});
  }, []);

  return null;
}
