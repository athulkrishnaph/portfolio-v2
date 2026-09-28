import { renderMarkdown } from './markdown';
import { SseParser } from './sse';

describe('SseParser', () => {
  function collect(chunks: string[]): [string, string][] {
    const events: [string, string][] = [];
    const parser = new SseParser((e, d) => events.push([e, d]));
    chunks.forEach((c) => parser.push(c));
    parser.flush();
    return events;
  }

  it('parses events split across network chunks', () => {
    expect(
      collect(['event: sources\nda', 'ta: []\n\nevent: delta\ndata: {"text":"Hi"}\n', '\nevent: done\ndata: {}\n\n']),
    ).toEqual([
      ['sources', '[]'],
      ['delta', '{"text":"Hi"}'],
      ['done', '{}'],
    ]);
  });

  it('handles CRLF line endings, comments and a final event without a blank line', () => {
    expect(collect([': keep-alive\r\n\r\nevent: delta\r\ndata: {"text":"x"}'])).toEqual([
      ['delta', '{"text":"x"}'],
    ]);
  });
});

describe('renderMarkdown', () => {
  it('renders paragraphs, bold, lists and code', () => {
    const html = renderMarkdown('Hello **world**\n\n- one\n- `two`\n\n1. first');
    expect(html).toBe(
      '<p>Hello <strong>world</strong></p><ul><li>one</li><li><code>two</code></li></ul><ol><li>first</li></ol>',
    );
  });

  it('escapes HTML so answers cannot inject markup', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)> <script>alert(1)</script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;');
  });

  it('only creates safe links', () => {
    expect(renderMarkdown('[site](https://example.com)')).toContain(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">site</a>',
    );
    expect(renderMarkdown('[projects](/projects)')).toContain('<a href="/projects">projects</a>');
    const evil = renderMarkdown('[click](javascript:alert(1))');
    expect(evil).not.toContain('<a');
    expect(evil).not.toContain('href');
  });

  it('turns a code span holding a site path into a link', () => {
    expect(renderMarkdown('see `/projects/task-flow`')).toContain(
      '<a href="/projects/task-flow">/projects/task-flow</a>',
    );
  });

  it('keeps code blocks verbatim', () => {
    expect(renderMarkdown('```\nconst a = **b**;\n```')).toBe('<pre><code>const a = **b**;</code></pre>');
  });
});
