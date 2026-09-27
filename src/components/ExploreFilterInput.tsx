import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

/** Show the same accessible text filter in browse directories and line details. */
export function ExploreFilterInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  /** Remove the filter while keeping the field ready for another query. */
  function clearFilter() {
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className="relative">
      <label className="grid text-sm font-semibold">
        <span className="sr-only">{label}</span>
        <input
          ref={inputRef}
          className="min-h-11 w-full min-w-55 rounded-xl border border-line bg-surface-card px-3 pr-11 text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
          type="text"
          role="searchbox"
          inputMode="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      </label>
      {value !== '' && (
        <button
          aria-label={t('explore.clearFilter')}
          className="motion-interactive absolute inset-y-0 right-1 grid w-10 place-items-center rounded-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          onClick={clearFilter}
          type="button"
        >
          <Icon name="close" size={17} />
        </button>
      )}
    </div>
  );
}
