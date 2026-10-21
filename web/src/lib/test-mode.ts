/**
 * Ambiente com trilhos de pagamento simulados: mostra o "Simular pagamento"
 * do Pix e os cartões de teste. Sempre em dev; em build, com VITE_TEST_MODE.
 */
export const testMode =
  import.meta.env.DEV || import.meta.env.VITE_TEST_MODE === 'true';
