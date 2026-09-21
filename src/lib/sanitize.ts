const ALLOWED_TAGS = new Set([
  "p", "br", "b", "i", "u", "s", "em", "strong", "a",
  "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "code", "span", "div", "img",
  "table", "thead", "tbody", "tr", "th", "td",
  "hr", "sub", "sup", "mark",
]);

const ALLOWED_ATTR = new Set([
  "href", "target", "rel", "src", "alt", "width", "height",
  "class", "style", "id", "colspan", "rowspan",
]);

export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";

  // Strip script/style/iframe/object/embed tags and their content entirely
  let clean = dirty
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<object[\s\S]*?<\/object\s*>/gi, "")
    .replace(/<embed[^>]*\/?>/gi, "")
    .replace(/<link[^>]*\/?>/gi, "")
    .replace(/<meta[^>]*\/?>/gi, "")
    .replace(/<base[^>]*\/?>/gi, "")
    .replace(/<form[\s\S]*?<\/form\s*>/gi, "")
    .replace(/<input[^>]*\/?>/gi, "")
    .replace(/<textarea[\s\S]*?<\/textarea\s*>/gi, "")
    .replace(/<button[\s\S]*?<\/button\s*>/gi, "")
    .replace(/<select[\s\S]*?<\/select\s*>/gi, "");

  // Process remaining tags: keep allowed ones with filtered attributes, strip others
  clean = clean.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)?\/?>/g, (match, tag: string, attrs: string) => {
    const tagLower = tag.toLowerCase();
    if (!ALLOWED_TAGS.has(tagLower)) return "";

    // Self-closing check
    const isClosing = match.startsWith("</");
    if (isClosing) return `</${tagLower}>`;

    // Filter attributes
    const cleanAttrs: string[] = [];
    if (attrs) {
      const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        const attrName = attrMatch[1].toLowerCase();
        const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";

        if (!ALLOWED_ATTR.has(attrName)) continue;

        // Block javascript: URIs in href/src
        if ((attrName === "href" || attrName === "src") && /^\s*javascript\s*:/i.test(attrValue)) continue;

        // Block event handlers disguised as style
        if (attrName === "style" && /expression\s*\(|url\s*\(\s*javascript/i.test(attrValue)) continue;

        cleanAttrs.push(`${attrName}="${attrValue.replace(/"/g, "&quot;")}"`);
      }
    }

    const isSelfClosing = match.endsWith("/>") || tagLower === "br" || tagLower === "hr" || tagLower === "img";
    const attrStr = cleanAttrs.length > 0 ? " " + cleanAttrs.join(" ") : "";
    return isSelfClosing ? `<${tagLower}${attrStr} />` : `<${tagLower}${attrStr}>`;
  });

  // Strip on* event attributes that might have slipped through
  clean = clean.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|\S+)/gi, "");

  return clean;
}
