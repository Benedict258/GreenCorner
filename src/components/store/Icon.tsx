// Every icon in the designs (1.5px line icons, 24px grid). Drawn inline so each page needs no sprite.
const PATHS = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  cart: <><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h7.7a1.5 1.5 0 0 0 1.5-1.1L20 8H6.2" /><circle cx="9.5" cy="20" r="1" /><circle cx="17" cy="20" r="1" /></>,
  box: <><path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" /><path d="M3 7.5l9 4.5 9-4.5M12 12v9" /></>,
  file: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>,
  board: <><rect x="6" y="6" width="12" height="12" rx="1.5" /><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3" /></>,
  sensor: <><circle cx="12" cy="15" r="1.6" /><path d="M7.5 15a4.5 4.5 0 0 1 9 0M4.5 15a7.5 7.5 0 0 1 15 0M12 7V4" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" /></>,
  battery: <><rect x="3" y="8" width="16" height="9" rx="2" /><path d="M21 11v3M7 11v3M11 11v3" /></>,
  motor: <><circle cx="12" cy="12" r="3.5" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>,
  led: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  display: <><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4M7 10h10M7 13h6" /></>,
  wifi: <><path d="M3 9.5a13 13 0 0 1 18 0M6 13a8.5 8.5 0 0 1 12 0M9 16.5a4 4 0 0 1 6 0" /><circle cx="12" cy="19.5" r=".8" /></>,
  tools: <path d="M14.5 5.5a4 4 0 0 0-4.8 5.2L3.5 17l3.5 3.5 6.3-6.2a4 4 0 0 0 5.2-4.8l-2.5 2.5-2.3-.5-.5-2.3z" />,
  wire: <><circle cx="3.5" cy="8" r="1" /><path d="M4.5 8h2c3.5 0 3.5 8 7 8h2.5" /><circle cx="20.5" cy="16" r="1" /></>,
  chip: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" /></>,
  truck: <><path d="M3 6h11v10H3zM14 9.5h4l3 3.5v3h-7" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" /></>,
  list: <><path d="M10 6h10M10 12h10M10 18h10" /><path d="M4 6l1 1 1.8-2M4 12l1 1 1.8-2M4 18l1 1 1.8-2" /></>,
  card: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></>,
  pin: <><path d="M12 21s7-6 7-11a7 7 0 0 0-14 0c0 5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></>,
  whatsapp: <><path d="M4 20l1.4-4.2A8 8 0 1 1 8.3 18.7z" /><path d="M9.2 9.2c.2 2.4 2.4 4.6 5 5.5l1-1.3-1.7-.9-.8.6c-.9-.4-1.7-1.2-2.1-2.1l.6-.8-.9-1.7z" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  chevron: <path d="M6 9l6 6 6-6" />,
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  bell: <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15zM10 21h4" />,
  loop: <path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4" />,
  cap: <path d="M2 9l10-5 10 5-10 5zM6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6" />,
  bag: <path d="M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2" />,
  out: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9" />,
  quote: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
  alert: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.2v.01" /></>,
  sync: <path d="M20 11a8 8 0 0 0-14-4M4 13a8 8 0 0 0 14 4M18 3v4h-4M6 21v-4h4" />,
  dash: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  stock: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5" />,
  folder: <path d="M3 7h6l2 2h10v10H3z" />,
  customers: <><circle cx="9" cy="8" r="3.2" /><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.8.6 3 2.2 3 4.5" /></>,
  settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></>,
  shield: <path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" />,
  activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  more: <><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></>,
  "more-v": <><circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" /></>,
  collapse: <path d="M15 6l-6 6 6 6M20 4v16" />,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  download: <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />,
  sort: <path d="M8 5v14M5 16l3 3 3-3M16 19V5M13 8l3-3 3 3" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  image: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M4 17l5-4 4 3 3-2 4 3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.8v.01" /></>,
  bulb: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  zoom: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5M11 8v6M8 11h6" /></>,
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "icon", size }: { name: IconName | string; className?: string; size?: number }) {
  const body = PATHS[name as IconName] ?? PATHS.box;
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false" width={size} height={size}>
      {body}
    </svg>
  );
}
