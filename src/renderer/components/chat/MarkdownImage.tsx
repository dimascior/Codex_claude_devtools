/**
 * MarkdownImage - An image referenced from Markdown in session content.
 */

import { api } from '@renderer/api';

/**
 * Markdown image in session content. Never fetched: a viewer of local session
 * logs makes no network requests on its own, and an image URL written by a
 * model or a tool can carry session data to the host it names. It is shown as
 * a link the user can open in the browser.
 */
export const MarkdownImage = ({
  src,
  alt,
}: {
  src?: string | Blob;
  alt?: string;
}): React.JSX.Element => {
  const url = typeof src === 'string' ? src : '';
  const label = alt?.trim() ? `Image: ${alt.trim()}` : 'Image';
  return (
    <a
      href={url || undefined}
      title={url ? `${url} (not loaded; click to open in the browser)` : 'Image not loaded'}
      className="cursor-pointer text-xs no-underline hover:underline"
      style={{ color: 'var(--prose-link)' }}
      onClick={(e) => {
        e.preventDefault();
        if (url) {
          void api.openExternal(url);
        }
      }}
    >
      [{label}]
    </a>
  );
};
