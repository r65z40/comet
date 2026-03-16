"use client";

import { useEffect } from "react";

export default function DynamicFavicon() {
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const logoUrl = data.site_logo;
        if (logoUrl) {
          // Update existing favicon link or create one
          let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = logoUrl;

          // Also update apple touch icon
          let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
          if (!appleLink) {
            appleLink = document.createElement("link");
            appleLink.rel = "apple-touch-icon";
            document.head.appendChild(appleLink);
          }
          appleLink.href = logoUrl;
        }
      })
      .catch(() => {
        // Silently fail - keep default favicon
      });
  }, []);

  return null;
}
