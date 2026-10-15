import { useState } from 'react';
import { faviconUrl, type CustomLink } from './links';

/** A link's icon: its emoji, or the site's favicon (falling back to 🔗 if that fails to load). */
export function LinkIcon({ link, className }: { link: Pick<CustomLink, 'url' | 'icon'>; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (link.icon !== 'favicon') return <span className={className}>{link.icon}</span>;
  if (failed || !link.url) return <span className={className}>🔗</span>;
  return (
    <span className={className}>
      <img className="favicon" src={faviconUrl(link.url)} alt="" onError={() => setFailed(true)} />
    </span>
  );
}
