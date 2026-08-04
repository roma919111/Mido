type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
};

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <label className="search-bar">
      <span className="search-bar__icon" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        placeholder="ابحث عن فيلم، مسلسل، رياضة…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />
    </label>
  );
}
