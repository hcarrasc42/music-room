// mobile/src/utils/emailCheck.ts
// Copia de backend/src/common/validation/email-check.ts: si cambias una, cambia la otra.

export type EmailCheck =
  | { ok: true }
  | { ok: false; error: string; suggestion?: string };

// Proveedores comunes y sus terminaciones reales
const PROVIDERS: Record<string, string[]> = {
  gmail: ['com'],
  googlemail: ['com'],
  hotmail: ['com', 'es'],
  outlook: ['com', 'es'],
  live: ['com'],
  yahoo: ['com', 'es'],
  icloud: ['com'],
};

// Dominios reales que se parecen a un proveedor y no hay que "corregir"
const REAL_LOOKALIKES = new Set(['mail.com', 'ymail.com', 'gmx.com', 'gmx.es', 'me.com', 'msn.com', 'aol.com']);

const FORMAT = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

export function checkEmail(input: string): EmailCheck {
  const email = input.trim().toLowerCase();
  if (!email.includes('@')) return { ok: false, error: 'Al email le falta la @' };
  if (email.split('@').length > 2) return { ok: false, error: 'El email tiene más de una @' };
  if (/\s/.test(email)) return { ok: false, error: 'El email no puede tener espacios' };
  if (email.endsWith('.')) {
    const fixed = email.replace(/\.+$/, '');
    const next = checkEmail(fixed);
    const suggestion = next.ok ? fixed : next.suggestion;
    if (suggestion) return { ok: false, error: `¿Quisiste decir ${suggestion}?`, suggestion };
  }
  if (email.includes('..') || !FORMAT.test(email)) {
    return { ok: false, error: 'El email no tiene un formato válido (ej. nombre@gmail.com)' };
  }

  const [local, domain] = email.split('@');
  if (REAL_LOOKALIKES.has(domain)) return { ok: true };

  const [name, ...rest] = domain.split('.');
  // Solo se comparan dominios simples (gmail.com); alumno.uned.es o mail.empresa.es se aceptan tal cual
  if (rest.length !== 1) return { ok: true };
  const tld = rest[0];

  // Proveedor conocido escrito tal cual, o con una errata pequeña (gmial, hotmial, outlok...)
  let provider = PROVIDERS[name] ? name : undefined;
  if (!provider) {
    let best = Infinity;
    for (const p of Object.keys(PROVIDERS)) {
      const dist = distance(name, p);
      if (dist < best && dist <= (p.length >= 5 ? 2 : 1)) { best = dist; provider = p; }
    }
  }
  if (!provider) return { ok: true }; // dominio desconocido (universidad, empresa...): se acepta

  const valid = PROVIDERS[provider];
  if (provider === name && valid.includes(tld)) return { ok: true };

  // .con, .cm, .comm, .es. ... → la terminación válida más parecida
  const fixedTld = valid.includes(tld) ? tld : valid.includes('es') && tld.startsWith('e') ? 'es' : 'com';
  const suggestion = `${local}@${provider}.${fixedTld}`;
  return { ok: false, error: `¿Quisiste decir ${suggestion}?`, suggestion };
}
