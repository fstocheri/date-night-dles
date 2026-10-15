import { useState } from 'react';
import { LinkDialog } from './LinkDialog';
import { LinkIcon } from './LinkIcon';
import { hostOf, loadLinks, newId, saveLinks, type CustomLink } from './links';

/** "Our other dles": tiles for outside games, plus an add tile. No play tracking. */
export function CustomLinks() {
  const [links, setLinks] = useState<CustomLink[]>(loadLinks);
  const [editing, setEditing] = useState<CustomLink | 'new' | null>(null);

  const update = (next: CustomLink[]) => {
    setLinks(next);
    saveLinks(next);
  };

  const save = (fields: Omit<CustomLink, 'id'>) => {
    if (editing === 'new') update([...links, { id: newId(), ...fields }]);
    else if (editing) update(links.map((l) => (l.id === editing.id ? { ...l, ...fields } : l)));
    setEditing(null);
  };

  const remove = () => {
    if (editing && editing !== 'new' && confirm(`Remove ${editing.name}?`)) {
      update(links.filter((l) => l.id !== editing.id));
      setEditing(null);
    }
  };

  return (
    <section className="custom-links">
      <div className="lineup-head">
        <h2>Our other dles</h2>
        <span className="muted">Links to games we play elsewhere</span>
      </div>

      <ul className="tiles">
        {links.map((link) => (
          <li key={link.id} className="tile-wrap">
            <a className="tile tile--link" href={link.url} target="_blank" rel="noopener noreferrer" title={link.url}>
              <LinkIcon link={link} className="tile__icon" />
              <strong className="tile__title">{link.name}</strong>
              <span className="tile__status">{hostOf(link.url)} ↗</span>
            </a>
            <button type="button" className="tile__edit" onClick={() => setEditing(link)} aria-label={`Edit ${link.name}`}>
              ✎
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="tile tile--add" onClick={() => setEditing('new')}>
            <span className="tile__icon" aria-hidden="true">
              +
            </span>
            <strong className="tile__title">Add a dle</strong>
            <span className="tile__status">Link any game</span>
          </button>
        </li>
      </ul>

      <LinkDialog editing={editing} onSave={save} onDelete={remove} onClose={() => setEditing(null)} />
    </section>
  );
}
