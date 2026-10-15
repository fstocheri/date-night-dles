import { useEffect, useRef, useState } from 'react';
import { LinkIcon } from './LinkIcon';
import { nameFromUrl, normalizeUrl, type CustomLink } from './links';

const EMOJIS = ['🎬', '📺', '🎵', '🎧', '🎤', '🎮', '🧩', '🔤', '🔢', '🌍', '🗺️', '🧠', '⚽', '🏀', '🏈', '🎨', '📚', '🍔', '🐾', '✈️', '🎯', '🃏', '💡', '⭐'];

interface Props {
  /** null = closed; 'new' = adding; a link = editing it. */
  editing: CustomLink | 'new' | null;
  onSave: (link: Omit<CustomLink, 'id'>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function LinkDialog({ editing, onSave, onDelete, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('favicon');
  const [error, setError] = useState('');

  // Open/close the native dialog and reset the form whenever a new edit starts.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (editing) {
      const link = editing === 'new' ? null : editing;
      setName(link?.name ?? '');
      setUrl(link?.url ?? '');
      setIcon(link?.icon ?? 'favicon');
      setError('');
      if (!el.open) el.showModal();
    } else if (el.open) {
      el.close();
    }
  }, [editing]);

  const normalized = normalizeUrl(url);
  const customEmoji = icon !== 'favicon' && !EMOJIS.includes(icon) ? icon : '';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalized) return setError('Enter a web address, like framed.wtf');
    const finalName = name.trim() || nameFromUrl(normalized);
    if (!finalName) return setError('Give it a name');
    onSave({ name: finalName, url: normalized, icon });
  };

  return (
    <dialog
      ref={dialog}
      className="dialog"
      onClose={onClose}
      // Clicking the backdrop (outside the form) closes it.
      onClick={(e) => e.target === dialog.current && onClose()}
      aria-labelledby="link-dialog-title"
    >
      <form className="dialog__form" onSubmit={submit}>
        <h2 id="link-dialog-title">{editing === 'new' ? 'Add a dle' : 'Edit link'}</h2>

        <label className="field">
          <span>Link</span>
          <input
            type="text"
            inputMode="url"
            value={url}
            placeholder="framed.wtf"
            autoFocus
            onChange={(e) => {
              setUrl(e.target.value);
              setError('');
            }}
            onBlur={() => !name && normalized && setName(nameFromUrl(normalized))}
          />
        </label>

        <label className="field">
          <span>Name</span>
          <input type="text" value={name} placeholder="Framed" maxLength={24} onChange={(e) => setName(e.target.value)} />
        </label>

        <fieldset className="field">
          <legend>Icon</legend>
          <div className="icon-picker" role="radiogroup">
            <button
              type="button"
              role="radio"
              aria-checked={icon === 'favicon'}
              className={`icon-option icon-option--site ${icon === 'favicon' ? 'is-selected' : ''}`}
              onClick={() => setIcon('favicon')}
              title="Use the site's own icon"
            >
              <LinkIcon link={{ url: normalized ?? '', icon: 'favicon' }} />
              <span>Site icon</span>
            </button>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="radio"
                aria-checked={icon === emoji}
                aria-label={emoji}
                className={`icon-option ${icon === emoji ? 'is-selected' : ''}`}
                onClick={() => setIcon(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="icon-custom"
            value={customEmoji}
            placeholder="…or type any emoji"
            maxLength={8}
            onChange={(e) => setIcon(e.target.value.trim() || 'favicon')}
          />
        </fieldset>

        {error && <p className="dialog__error">{error}</p>}

        <div className="dialog__actions">
          {editing !== 'new' && (
            <button type="button" className="button button--danger" onClick={onDelete}>
              Delete
            </button>
          )}
          <span className="dialog__spacer" />
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button">
            {editing === 'new' ? 'Add' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
