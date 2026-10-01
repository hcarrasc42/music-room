// Nombre de usuario: 3-20 caracteres, letras minúsculas, números, _ y . (sin empezar ni acabar en punto).
// Se guarda siempre en minúsculas, así Hasi42 y hasi42 son el mismo.
export const USERNAME_REGEX = /^(?!\.)(?!.*\.$)[a-z0-9_.]{3,20}$/;
export const USERNAME_RULES = 'El nombre de usuario debe tener 3-20 caracteres: letras, números, _ y . (sin empezar ni acabar en punto)';

export const normalizeUsername = (value: string) => value.trim().replace(/^@/, '').toLowerCase();
