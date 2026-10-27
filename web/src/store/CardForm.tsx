import type { CardField } from '../lib/api';
import { testMode } from '../lib/test-mode';
import { brl } from '../lib/format';
import { Field } from '../ui/components';

export interface CardFormValue {
  number: string; // como digitado, com espaços: "4242 4242 4242 4242"
  name: string;
  expiry: string; // "MM/AA"
  cvc: string;
  installments: number;
}

export const emptyCard: CardFormValue = {
  number: '',
  name: '',
  expiry: '',
  cvc: '',
  installments: 1,
};

// a loja oferece até 3× sem juros (o PSP aceita até 12)
const MAX_INSTALLMENTS = 3;

const digits = (s: string) => s.replace(/\D/g, '');

function luhn(pan: string) {
  let sum = 0;
  for (let i = 0; i < pan.length; i++) {
    let digit = Number(pan[pan.length - 1 - i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Confere o básico antes de mandar ao PSP, para o cliente corrigir na hora.
 * Quem decide de verdade (bandeira, validade, recusa) é o PSP.
 */
export function checkCard(
  card: CardFormValue,
  now = new Date(),
): Partial<Record<CardField, string>> {
  const errors: Partial<Record<CardField, string>> = {};
  const pan = digits(card.number);
  if (pan.length < 13 || pan.length > 19 || !luhn(pan))
    errors.number = 'Número do cartão inválido.';
  if (!card.name.trim()) errors.name = 'Informe o nome impresso no cartão.';

  const [mm, yy] = card.expiry.split('/').map(Number);
  const current = now.getFullYear() * 12 + now.getMonth() + 1;
  if (!(mm >= 1 && mm <= 12) || Number.isNaN(yy))
    errors.expiry = 'Use o formato MM/AA.';
  else if ((2000 + yy) * 12 + mm < current)
    errors.expiry = 'Este cartão está vencido.';

  const cvcLength = /^3[47]/.test(pan) ? 4 : 3; // American Express: 4
  if (digits(card.cvc).length !== cvcLength)
    errors.cvc = `O código tem ${cvcLength} dígitos.`;
  return errors;
}

/** O que vai para POST /v1/tokens do PSP. */
export function toTokenRequest(card: CardFormValue) {
  const [mm, yy] = card.expiry.split('/').map(Number);
  return {
    number: digits(card.number),
    expMonth: mm,
    expYear: 2000 + yy,
    cvc: digits(card.cvc),
    holderName: card.name.trim(),
  };
}

const formatNumber = (s: string) =>
  digits(s)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ');

const formatExpiry = (s: string) => {
  const d = digits(s).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

export function CardForm({
  value,
  onChange,
  errors,
  total,
  disabled,
}: {
  value: CardFormValue;
  onChange: (value: CardFormValue) => void;
  errors: Partial<Record<CardField, string>>;
  total: number;
  disabled?: boolean;
}) {
  const set =
    <K extends keyof CardFormValue>(key: K, format?: (s: string) => string) =>
    (v: string) =>
      onChange({ ...value, [key]: format ? format(v) : v });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field
        id="card-number"
        label="Número do cartão"
        icon="card"
        placeholder="0000 0000 0000 0000"
        inputMode="numeric"
        autoComplete="cc-number"
        value={value.number}
        onChange={set('number', formatNumber)}
        error={errors.number}
        disabled={disabled}
      />
      <Field
        id="card-name"
        label="Nome impresso no cartão"
        placeholder="Como está no cartão"
        autoComplete="cc-name"
        value={value.name}
        onChange={set('name')}
        error={errors.name}
        disabled={disabled}
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field
          id="card-expiry"
          label="Validade"
          placeholder="MM/AA"
          inputMode="numeric"
          autoComplete="cc-exp"
          maxLength={5}
          value={value.expiry}
          onChange={set('expiry', formatExpiry)}
          error={errors.expiry}
          disabled={disabled}
        />
        <Field
          id="card-cvc"
          label="Código de segurança"
          placeholder="CVC"
          inputMode="numeric"
          autoComplete="cc-csc"
          maxLength={4}
          value={value.cvc}
          onChange={set('cvc', (s) => digits(s).slice(0, 4))}
          error={errors.cvc}
          disabled={disabled}
        />
      </div>
      <div className="field">
        <label htmlFor="card-installments">Parcelas</label>
        <div className="ctl">
          <select
            id="card-installments"
            value={value.installments}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, installments: Number(e.target.value) })
            }
          >
            {Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1).map(
              (n) => (
                <option key={n} value={n}>
                  {n === 1
                    ? `À vista · ${brl(total)}`
                    : `${n}× de ${brl(total / n)} sem juros`}
                </option>
              ),
            )}
          </select>
        </div>
      </div>
      {testMode && (
        <p className="help">
          Ambiente de teste: 4242 4242 4242 4242 aprova, 4000 0000 0000 9995
          recusa por saldo. Qualquer validade futura e CVC.
        </p>
      )}
    </div>
  );
}
