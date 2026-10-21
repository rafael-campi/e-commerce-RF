import { createHmac, timingSafeEqual } from 'crypto';

// entregas mais velhas que isso são recusadas (proteção contra replay)
const TOLERANCE_SECONDS = 300;

/**
 * Confere o cabeçalho PSP-Signature (`t=<unix>,v1=<hex>`) contra o corpo cru,
 * como documenta o README do payment-ledger-service.
 */
export function verifyPspSignature(
  header: string | undefined,
  rawBody: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!header) return false;

  const parts = header.split(',').map((p) => p.split('=', 2));
  const timestamp = Number(parts.find(([k]) => k === 't')?.[1]);
  const signatures = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
  if (!Number.isInteger(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - timestamp) > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest();
  return signatures.some((signature) => {
    const given = Buffer.from(signature, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
