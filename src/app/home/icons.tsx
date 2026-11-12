// ============================================================
// UXLLY — /home Material Symbols icon helper
// Renders icons as ligature text, same technique as the original.
// Font is loaded via Google's hosted stylesheet in layout metadata
// below (no local font file was provided to self-host).
// ============================================================

export function MaterialSymbol({
  name,
  className,
  fill = 0,
  weight = 300,
  grade = 0,
  opticalSize = 24,
  style,
  ...props
}: React.ComponentProps<"span"> & {
  name: string;
  fill?: 0 | 1;
  weight?: number;
  grade?: number;
  opticalSize?: number;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined${className ? ` ${className}` : ""}`}
      style={{
        fontVariationSettings: `"FILL" ${fill}, "wght" ${weight}, "GRAD" ${grade}, "opsz" ${opticalSize}`,
        ...style,
      }}
      {...props}
    >
      {name}
    </span>
  );
}