import { useTranslation } from 'react-i18next';
import { ExploreFilterInput } from './ExploreFilterInput';

/** Show a browse directory's heading and its local text filter. */
export function ExploreDirectoryHeading({
  id,
  title,
  placeholder,
  query,
  onQueryChange,
}: {
  id: string;
  title: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <h2 id={id} className="text-2xl font-bold tracking-[-0.5px]">
        {title}
      </h2>
      <ExploreFilterInput
        label={t('explore.filter')}
        placeholder={placeholder}
        value={query}
        onChange={onQueryChange}
      />
    </div>
  );
}
