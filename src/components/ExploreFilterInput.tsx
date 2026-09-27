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
  return (
    <label className="grid text-sm font-semibold">
      <span className="sr-only">{label}</span>
      <input
        className="min-h-11 w-full min-w-55 rounded-xl border border-line bg-surface-card px-3 text-ink outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
