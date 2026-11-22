const P = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};
export const ICheck = () => (
  <svg {...P}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const IExit = () => (
  <svg {...P}>
    <path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" />
  </svg>
);
