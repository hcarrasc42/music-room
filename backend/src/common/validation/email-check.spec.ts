import { checkEmail } from './email-check.js';

const suggestionFor = (email: string) => {
  const r = checkEmail(email);
  return r.ok ? null : r.suggestion;
};

describe('checkEmail', () => {
  it.each([
    'pepe@gmail.com',
    'Pepe@Gmail.com',
    'pepe@hotmail.es',
    'pepe@outlook.com',
    'pepe@icloud.com',
    'pepe@alumno.uned.es',
    'pepe@mail.uned.es',
    'pepe@empresa.org',
    'pepe@mail.com',
    'pepe@ymail.com',
  ])('acepta %s', (email) => {
    expect(checkEmail(email)).toEqual({ ok: true });
  });

  it.each([
    ['therialgodoy@gmail.con', 'therialgodoy@gmail.com'],
    ['pepe@gmial.com', 'pepe@gmail.com'],
    ['pepe@gmal.com', 'pepe@gmail.com'],
    ['pepe@gmail.cm', 'pepe@gmail.com'],
    ['pepe@gmail.comm', 'pepe@gmail.com'],
    ['pepe@gmail.es', 'pepe@gmail.com'],
    ['pepe@hotmial.com', 'pepe@hotmail.com'],
    ['pepe@hotmail.es.', 'pepe@hotmail.es'],
    ['pepe@outlok.es', 'pepe@outlook.es'],
    ['pepe@yahoo.con', 'pepe@yahoo.com'],
  ])('sugiere corregir %s → %s', (email, expected) => {
    expect(suggestionFor(email)).toBe(expected);
  });

  it.each(['pepegmail.com', 'pe pe@gmail.com', 'pepe@@gmail.com', 'pepe@gmail', 'pepe@gmail..com', '@gmail.com'])(
    'rechaza %s sin sugerencia',
    (email) => {
      const r = checkEmail(email);
      expect(r.ok).toBe(false);
      expect(r.ok ? undefined : r.suggestion).toBeUndefined();
    },
  );
});
