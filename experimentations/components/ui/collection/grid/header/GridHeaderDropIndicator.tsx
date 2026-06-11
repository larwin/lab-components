type GridHeaderDropIndicatorProps = {
  active: boolean;
  left: number;
  top?: number;
  height: number;
};

export function GridHeaderDropIndicator({
  active,
  left,
  top = 4,
  height,
}: GridHeaderDropIndicatorProps) {
  if (!active) {
    return null;
  }

  return (
    <div
      data-grid-header-drop-indicator="true"
      style={{
        position: 'absolute',
        left,
        top,
        height,
        width: 0,
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -1,
          top: 0,
          width: 2,
          height,
          borderRadius: 9999,
          background: 'hsl(var(--primary))',
          boxShadow: '0 0 0 1px hsl(var(--background))',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -4,
          top: -2,
          width: 8,
          height: 8,
          borderRadius: 9999,
          background: 'hsl(var(--primary))',
          boxShadow: '0 0 0 2px hsl(var(--background))',
        }}
      />
    </div>
  );
}



