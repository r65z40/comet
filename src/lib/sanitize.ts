import DOMPurify from "isomorphic-dompurify";

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      "p", "br", "b", "i", "u", "s", "em", "strong", "a",
      "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
      "blockquote", "pre", "code", "span", "div", "img",
      "table", "thead", "tbody", "tr", "th", "td",
      "hr", "sub", "sup", "mark",
    ],
    ALLOWED_ATTR: [
      "href", "target", "rel", "src", "alt", "width", "height",
      "class", "style", "id", "colspan", "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
  });
}
