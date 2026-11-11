const paths = {
  arrowDown: 'M12 4v15m-6-6 6 6 6-6',
  shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-10 2 2 4-4',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevronLeft: 'm15 18-6-6 6-6',
  logout: 'M9 5H4v14h5m5-11 4 4-4 4m-6-4h10',
  moreVertical:
    'M12 5.5a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Zm0 7a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Zm0 7a.5.5 0 1 1 0-1 .5.5 0 0 1 0 1Z',
};

export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
