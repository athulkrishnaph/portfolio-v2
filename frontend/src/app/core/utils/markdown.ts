/**
 * Tiny, dependency-free Markdown renderer for chatbot answers.
 *
 * Supports what the assistant uses: paragraphs, line breaks, **bold**,
 * *italic*, `code`, ``` code blocks, bullet and numbered lists, headings
 * (rendered as bold lines) and [links](url).
 *
 * Safety: all text is HTML-escaped FIRST, and only a fixed set of tags is
 * produced afterwards. Links are limited to http(s) URLs and site-relative
 * paths, so `javascript:` URLs can never be created. Angular's sanitizer
 * then checks the result once more when it is bound with [innerHTML].
 */
export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list) {
      html.push(`<${list.type}>${list.items.map((i) => `<li>${inline(i)}</li>`).join('')}</${list.type}>`);
      list = null;
    }
  };

  for (const line of lines) {
    if (code) {
      if (/^\s*```/.test(line)) {
        html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = null;
      } else {
        code.push(line);
      }
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushParagraph();
      flushList();
      code = [];
      continue;
    }

    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line);

    if (bullet || numbered) {
      flushParagraph();
      const type = bullet ? 'ul' : 'ol';
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push((bullet ?? numbered)![1]);
    } else if (heading) {
      flushParagraph();
      flushList();
      html.push(`<p><strong>${inline(heading[1])}</strong></p>`);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  if (code) html.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  flushParagraph();
  flushList();
  return html.join('');
}

/** Inline formatting on one line (escaped first). */
function inline(text: string): string {
  const codeSpans: string[] = [];
  // Protect `code` spans from further formatting. A span that is just a
  // site path (`/projects/task-flow`) becomes a link.
  let out = escapeHtml(text).replace(/`([^`]+)`/g, (_, content: string) => {
    const html = /^\/[a-z0-9/_-]*$/i.test(content)
      ? link(content, content)
      : `<code>${content}</code>`;
    codeSpans.push(html);
    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  out = out
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => link(url, label))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');

  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => codeSpans[Number(i)]);
}

/** Builds a link only for safe URLs; anything else stays plain text. */
function link(url: string, label: string): string {
  const decoded = url.replace(/&amp;/g, '&');
  const internal = /^\/(?!\/)/.test(decoded);
  if (!internal && !/^https?:\/\//i.test(decoded)) {
    return label;
  }
  const attrs = internal ? '' : ' target="_blank" rel="noopener noreferrer"';
  return `<a href="${url}"${attrs}>${label}</a>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
