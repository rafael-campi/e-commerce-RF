import { useSyncExternalStore } from 'react';

// O CSS do protótipo troca o layout por .app[data-device="mobile"]; aqui isso vem da largura.
const query = '(max-width: 760px)';

const subscribe = (notify: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', notify);
  return () => mq.removeEventListener('change', notify);
};

export type Device = 'mobile' | 'desktop';

export function useDevice(): Device {
  return useSyncExternalStore(subscribe, () =>
    window.matchMedia(query).matches ? 'mobile' : 'desktop',
  );
}
