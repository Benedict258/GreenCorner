// ADMIN_PASSWORD_HASH is pasted by hand into a host's dashboard, so tolerate the usual copy-paste
// noise: surrounding whitespace or quotes. Returns null when what is left is not a bcrypt hash.
const BCRYPT = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export function readPasswordHash(raw: string | undefined): string | null {
  const hash = (raw ?? "").trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  return BCRYPT.test(hash) ? hash : null;
}
