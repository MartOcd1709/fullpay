// One stroke icon set (lucide-style paths, drawn inline: no icon dependency). Always decorative: pair with a word.
const PATHS = {
  draft: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4Z",
  bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  bellRing: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0M4 2C2.8 3.7 2 5.7 2 8M22 8c0-2.3-.8-4.3-2-6",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
  alert: "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01",
  circleDot: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  check: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
  tick: "M20 6 9 17l-5-5",
  dispute: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2ZM12 7v4M12 15h.01",
  handshake: "M11 17l2 2a1 1 0 1 0 3-3M14 14l2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a3 3 0 0 0-4.2 0l-.9.9a1 1 0 1 1-3-3l2.8-2.8a5.8 5.8 0 0 1 7.1-.9l.5.3a2 2 0 0 0 1.4.2L21 4M21 3l1 11h-2M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3M3 4h8",
  handshakeOff: "M3 3l18 18M11 17l2 2a1 1 0 1 0 3-3M3 4h5M2 14l6.5 6.5a1 1 0 1 0 3-3M21 3l1 11h-2",
  snooze: "M6.9 6.9a8 8 0 1 0 11.3 11.3M19.9 14.2a8 8 0 0 0-9.1-9.1M22 6l-3-3M6.3 18.7 4 21M2 2l20 20M4 4 2 6",
  shieldCheck: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9 12l2 2 4-4",
  shieldAlert: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM12 8v4M12 16h.01",
  shieldQuestion: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10ZM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 16v-4M12 8h.01",
  mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM22 6l-10 7L2 6",
  mailX: "M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9M22 6l-10 7L2 6M17 17l4 4M21 17l-4 4",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  letter: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8ZM14 2v6h6M16 13H8M16 17H8M10 9H8",
  flag: "M4 22V4M4 4h12l-1.5 4L16 12H4",
  lock: "M7 11V7a5 5 0 0 1 10 0v4M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z",
  close: "M18 6 6 18M6 6l12 12",
  chevron: "m9 18 6-6-6-6",
  print: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  plus: "M12 5v14M5 12h14",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  copy: "M8 8h12v12H8zM4 16V4h12",
  rupee: "M6 3h12M6 8h12M6 13l8.5 8M6 13h3a5 5 0 0 0 0-10",
  user: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  trend: "M3 17l6-6 4 4 8-8M14 7h7v7",
  bank: "M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2l10 6H2Z",
  scale: "M12 3v18M7 21h10M5 7l-3 7a4 4 0 0 0 6 0ZM19 7l-3 7a4 4 0 0 0 6 0ZM3 7h18",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  external: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
  hash: "M4 9h16M4 15h16M10 3 8 21M16 3l-2 18",
  eyeOff: "M2 2l20 20M10.6 6.1A10 10 0 0 1 22 12a17 17 0 0 1-2.6 3.4M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
};

export function Icon({ name, className = "h-5 w-5", strokeWidth = 2 }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={`${className} shrink-0`} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

export default Icon;
