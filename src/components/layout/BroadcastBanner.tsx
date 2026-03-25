"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

function sanitizeHtml(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  // Remove script tags and event handlers
  div.querySelectorAll("script, iframe, object, embed, form").forEach((el) => el.remove());
  div.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith("on") || attr.name === "srcdoc" || (attr.name === "href" && attr.value.trimStart().startsWith("javascript:"))) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return div.innerHTML;
}

export default function BroadcastBanner() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/broadcast")
      .then((r) => r.json())
      .then((data) => {
        if (data.enabled && data.message) {
          // Check if user dismissed this exact message
          const dismissedMsg = localStorage.getItem("broadcast_dismissed");
          if (dismissedMsg === data.message) {
            setDismissed(true);
            return;
          }
          setMessage(data.message);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!visible || dismissed) return null;

  return (
    <div className="relative border-b border-primary-200 bg-primary-50">
      <div className="mx-auto max-w-7xl px-4 py-3 pr-12 sm:px-6">
        <div
          className="broadcast-content text-sm text-slate-700 [&_a]:text-primary-600 [&_a]:underline [&_img]:inline-block [&_img]:max-h-40 [&_img]:rounded [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(message) }}
        />
      </div>
      <button
        onClick={() => {
          setVisible(false);
          setDismissed(true);
          localStorage.setItem("broadcast_dismissed", message);
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-primary-100 hover:text-slate-600 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
