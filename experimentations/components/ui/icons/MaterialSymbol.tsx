type MaterialSymbolProps = {
  name: string;
  size?: number;
  className?: string;
  filled?: boolean;
};

export function MaterialSymbol({
  name,
  size = 18,
  className,
  filled = false,
}: MaterialSymbolProps) {
  return (
    <span
      aria-hidden="true"
      className={['material-symbols-outlined select-none', className].filter(Boolean).join(' ')}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24',
        lineHeight: 1,
      }}
    >
      {name}
    </span>
  );
}
