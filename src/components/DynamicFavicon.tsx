"use client";

import { useEffect } from "react";

export default function DynamicFavicon() {
  useEffect(() => {
    fetch("/api/branding")
      .then((r) => r.json())
      .then((data) => {
        const faviconUrl = data.site_favicon || data.site_logo;
        if (faviconUrl) {
          let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = faviconUrl;

          let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
          if (!appleLink) {
            appleLink = document.createElement("link");
            appleLink.rel = "apple-touch-icon";
            document.head.appendChild(appleLink);
          }
          appleLink.href = faviconUrl;
        }
      })
      .catch(() => {});
  }, []);

  return null;
}
