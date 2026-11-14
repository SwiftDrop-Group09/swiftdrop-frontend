/** Generate static brand assets from the same source as the shadcn theme. */
export function createBrandFavicon(stylesheet: string): string {
  const root = stylesheet.match(/:root\s*\{([^}]+)\}/)?.[1];
  const color = root?.match(/--brand-primary\s*:\s*([^;]+);/)?.[1]?.trim();
  if (
    !color ||
    !/^(?:#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})|[a-z]+|(?:oklch|oklab|rgb|rgba|hsl|hsla)\([\d.%\s,/+-]+\))$/i.test(
      color,
    )
  )
    throw new Error(
      'Set :root --brand-primary to a concrete CSS color to generate the favicon.',
    );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 48">
  <rect width="240" height="48" rx="8" fill="white"/>
  <text x="8" y="34" font-family="Arial, sans-serif" font-size="34" font-weight="800" letter-spacing="-1.5"><tspan fill="${color}">Swift</tspan><tspan fill="#000">Drop</tspan><tspan fill="${color}">.</tspan></text>
</svg>
`;
}
