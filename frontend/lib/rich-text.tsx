/* ============================================================
   NOVIQ — safe rich-text subset for Knowledge Hub bodies
   ------------------------------------------------------------
   The admin writes article bodies as plain text with a tiny Word-like
   syntax (toolbar in Site Content → News & Resources inserts it):

     **bold**  *italic*  `code`  [text](https://url)
     [color:#e11d48]red text[/color]   (hex 3/6 or plain color name)
     [size:18]bigger text[/size]       (px, clamped to 12–32)

   This module turns that text into HTML containing ONLY our own tags
   (strong/em/code/a/span/br) with validated attributes. Everything
   else is escaped FIRST, so raw HTML, javascript: links and rogue
   styles can never reach the page — render with dangerouslySetInnerHTML
   safely (see RichText below).

   The admin preview (backend/admin/index.html) carries a line-by-line
   mirror of the core below; both are pinned by tests/resources-rich
   which evals the marked CORE block straight out of this file.
   ============================================================ */
import React from 'react';

/* RICH-CORE-START */
/* NOTE: this block is intentionally annotation-free (JSDoc types only) so
   tests/resources-rich.test.cjs can eval it verbatim in plain Node and
   pin the grammar. Keep it that way. */
/** @param {string} s @returns {string} */
function richEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** @param {string} s @returns {string} */
function richInline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

/** @param {string} url @returns {boolean} */
function richUrlOk(url: string): boolean {
  return /^(https?:\/\/|mailto:)[^\s"'<>]+$/i.test(url);
}

/** @param {string} color @returns {boolean} */
function richColorOk(color: string): boolean {
  return /^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|[a-zA-Z]+)$/.test(color);
}

/** @param {string} raw @returns {string} */
/** @param {string} raw @returns {string} */
export function renderRichText(raw: string): string {
  if (!raw) return '';
  let s = richEscape(raw);
  /* Code spans are lifted out first so stars and brackets inside code
     stay literal. */
  /** @type {string[]} */
  const codes: string[] = [];
  s = s.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    codes.push(`<code>${code}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    if (!richUrlOk(url)) return text;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${richInline(text)}</a>`;
  });
  s = s.replace(/\[color:([^\]\n]+)\]([\s\S]*?)\[\/color\]/g, (_m, color: string, text: string) => {
    if (!richColorOk(color)) return text;
    return `<span style="color:${color}">${richInline(text)}</span>`;
  });
  s = s.replace(/\[size:(\d{1,2})\]([\s\S]*?)\[\/size\]/g, (_m, size: string, text: string) => {
    const px = Math.max(12, Math.min(32, parseInt(size, 10) || 16));
    return `<span style="font-size:${px}px">${richInline(text)}</span>`;
  });
  s = richInline(s);
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)] || '');
  return s.replace(/\n/g, '<br>');
}
/* RICH-CORE-END */

/** React wrapper: the HTML above is allowlisted by construction. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const html = React.useMemo(() => renderRichText(text || ''), [text]);
  if (!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default RichText;
