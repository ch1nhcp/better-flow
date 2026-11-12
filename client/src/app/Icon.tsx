const paths = {
  arrowDown: 'M12 4v15m-6-6 6 6 6-6',
  shield: 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Zm-3-10 2 2 4-4',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',
  code: 'm8 6-6 6 6 6m8-12 6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  chevronLeft: 'm15 18-6-6 6-6',
  close: 'm6 6 12 12M18 6 6 18',
  book: 'M12 7v14M2 5h6a4 4 0 0 1 4 4 4 4 0 0 1 4-4h6v14h-6a4 4 0 0 0-4 2 4 4 0 0 0-4-2H2Z',
  save: 'M4 3h13l4 4v14H3V3Zm3 0v6h10V3M7 21v-8h10v8',
  download: 'M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4',
  share:
    'M9 11l6-4M9 13l6 4M9 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm12-6a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm0 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  check: 'm5 12 4 4L19 6',
  fit: 'M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5',
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
