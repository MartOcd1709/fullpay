const PATHS = {
  shieldCheck: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3.5 9 2.5 2.5 4.5-5",
  shieldAlert: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm0 5v5m0 3v.5",
  shieldQuestion: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-2.2 6.5a2.3 2.3 0 1 1 3.2 2.1c-.6.3-1 .8-1 1.4v.5m0 2.5v.5",
  check: "M5 12.5 9.5 17 19 7",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2",
  alert: "M12 3 2.5 20h19L12 3Zm0 6v5m0 3v.5",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v5m0-8v.5",
  pause: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM10 9v6m4-6v6",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2v2h-2zM18 14h2v2h-2z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  scale: "M12 3v18M7 21h10M5 7h14M5 7l-3 6a3 3 0 0 0 6 0L5 7Zm14 0-3 6a3 3 0 0 0 6 0l-3-6Z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z",
  chart: "M3 17l6-6 4 4 8-8M14 7h7v7",
  bank: "M3 10h18M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18M12 3 3 8h18l-9-5Z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
};

export default function Icon({ name, className = "h-5 w-5" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}
