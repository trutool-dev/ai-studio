'use strict';

/**
 * SEC-46 (SA-16 + JB-14) — crypto.util fail-closed:
 * - encrypt/decrypt lanzan CryptoConfigError si falta la clave o es inválida
 *   (antes devolvían el texto plano)
 * - decrypt no acepta valores sin formato cifrado (antes los devolvía tal cual)
 * - HMAC con secreto obligatorio y verificación en tiempo constante
 */

const crypto = require('crypto');
const {
  encryptAES256,
  decryptAES256,
  hmacSHA256,
  verifyHmacSHA256,
  safeEqual,
  isValidAesKey,
  CryptoConfigError,
  generateVerificationCode,
  generateSecureToken,
} = require('../../backend/src/utils/crypto.util');

const KEY = crypto.randomBytes(32).toString('hex');
const OTHER_KEY = crypto.randomBytes(32).toString('hex');
const HMAC_SECRET = 'h'.repeat(48);

describe('isValidAesKey', () => {
  test.each([
    [KEY, true],
    [KEY.toUpperCase(), true],
    ['', false],
    [undefined, false],
    ['abc', false],
    [KEY.slice(0, 63), false],
    [KEY + '0', false],
    ['z'.repeat(64), false],
  ])('%p → %p', (k, expected) => expect(isValidAesKey(k)).toBe(expected));
});

describe('encryptAES256 / decryptAES256', () => {
  test('round-trip con clave válida', () => {
    const enc = encryptAES256('{"plan":"secreto"}', KEY);
    expect(enc).not.toContain('secreto');
    expect(enc.split(':')).toHaveLength(3);
    expect(decryptAES256(enc, KEY)).toBe('{"plan":"secreto"}');
  });

  test('IV aleatorio: dos cifrados del mismo texto difieren', () => {
    expect(encryptAES256('x', KEY)).not.toBe(encryptAES256('x', KEY));
  });

  test.each([undefined, '', 'short', 'g'.repeat(64)])('encrypt con clave %p lanza CryptoConfigError (no devuelve texto plano)', (k) => {
    expect(() => encryptAES256('datos de salud', k)).toThrow(CryptoConfigError);
  });

  test.each([undefined, '', 'short'])('decrypt con clave %p lanza CryptoConfigError', (k) => {
    expect(() => decryptAES256('aa:bb:cc', k)).toThrow(CryptoConfigError);
  });

  test('decrypt rechaza texto plano sin formato cifrado (devuelve null, no el valor)', () => {
    expect(decryptAES256('{"plan":"inyectado"}', KEY)).toBeNull();
    expect(decryptAES256('a:b', KEY)).toBeNull();
    expect(decryptAES256('', KEY)).toBeNull();
    expect(decryptAES256(null, KEY)).toBeNull();
  });

  test('decrypt con otra clave → null', () => {
    const enc = encryptAES256('hola', KEY);
    expect(decryptAES256(enc, OTHER_KEY)).toBeNull();
  });

  test('decrypt de un valor manipulado → null (autenticación GCM)', () => {
    const enc = encryptAES256('hola mundo', KEY);
    const [iv, tag, data] = enc.split(':');
    const flipped = Buffer.from(data, 'base64');
    flipped[0] ^= 0xff;
    expect(decryptAES256([iv, tag, flipped.toString('base64')].join(':'), KEY)).toBeNull();
  });
});

describe('hmacSHA256 / verifyHmacSHA256', () => {
  test('HMAC determinista con secreto válido', () => {
    expect(hmacSHA256('data', HMAC_SECRET)).toBe(hmacSHA256('data', HMAC_SECRET));
    expect(hmacSHA256('data', HMAC_SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  test.each([undefined, '', 'corto'])('secreto %p → CryptoConfigError (antes devolvía "")', (s) => {
    expect(() => hmacSHA256('data', s)).toThrow(CryptoConfigError);
    expect(() => verifyHmacSHA256('data', 'x', s)).toThrow(CryptoConfigError);
  });

  test('verifica un HMAC correcto', () => {
    const mac = hmacSHA256('payload', HMAC_SECRET);
    expect(verifyHmacSHA256('payload', mac, HMAC_SECRET)).toBe(true);
  });

  test('rechaza HMAC incorrecto, de otra longitud o no string', () => {
    const mac = hmacSHA256('payload', HMAC_SECRET);
    expect(verifyHmacSHA256('payload2', mac, HMAC_SECRET)).toBe(false);
    expect(verifyHmacSHA256('payload', mac.slice(1), HMAC_SECRET)).toBe(false);
    expect(verifyHmacSHA256('payload', undefined, HMAC_SECRET)).toBe(false);
  });

  test('usa crypto.timingSafeEqual', () => {
    const spy = jest.spyOn(crypto, 'timingSafeEqual');
    const mac = hmacSHA256('p', HMAC_SECRET);
    verifyHmacSHA256('p', mac, HMAC_SECRET);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('safeEqual', () => {
  test('iguales → true', () => expect(safeEqual('abc', 'abc')).toBe(true));
  test('distintos → false', () => expect(safeEqual('abc', 'abd')).toBe(false));
  test('distinta longitud → false sin lanzar', () => expect(safeEqual('abc', 'abcd')).toBe(false));
  test('no string → false', () => {
    expect(safeEqual(undefined, 'a')).toBe(false);
    expect(safeEqual('a', null)).toBe(false);
  });
});

describe('utilidades existentes', () => {
  test('generateVerificationCode devuelve 6 dígitos', () => {
    expect(generateVerificationCode()).toMatch(/^\d{6}$/);
  });
  test('generateSecureToken devuelve un UUID', () => {
    expect(generateSecureToken()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
