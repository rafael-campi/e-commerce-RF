# 0001 — Pagamentos via o PSP próprio, de forma assíncrona

- Status: aceita
- Data: 2026-10-21

## Contexto

Hoje o Pagamento é síncrono: a loja chama a `LocalPaymentGateway`, que não cobra nada, e grava o Pedido na hora. Com Pix real isso não funciona, porque o cliente paga o QR depois. E se a gravação falhar depois de uma cobrança aprovada, o cliente paga e fica sem Pedido.

A loja passa a ser um lojista do PSP próprio (`payment-ledger-service`, ADR 0001 de lá), e se integra a ele como faria com a Stripe.

## Decisão

- Pagar um Carrinho cria uma **Tentativa de pagamento** no PSP com `POST /v1/payments`. A chamada leva:
  - a chave secreta `sk_`;
  - o cabeçalho `Idempotency-Key` com o valor `cart-<id>-attempt-<n>`;
  - o valor em centavos inteiros com `currency: "BRL"`.
- Enquanto a Tentativa está pendente, o Estoque fica reservado e o Carrinho não pode ser editado. A Tentativa expira junto com a cobrança.
- O **Pedido** só é criado quando chega o webhook `payment.succeeded`. Se chegar `payment.failed` ou `payment.expired`, a loja libera o Estoque e reabre o Carrinho.
- O endpoint `POST /webhooks/payments` verifica a assinatura HMAC e trata cada evento só uma vez, pelo `id` do evento.
- Os dados do cartão nunca passam pela loja: o navegador tokeniza o cartão direto no PSP (`POST /v1/tokens`, chave `pk_`), e a loja recebe só o token.
- A `LocalPaymentGateway` continua existindo como implementação falsa para os testes.

## Consequências

- O glossário (`CONTEXT.md`) precisa do termo **Tentativa de pagamento**. A frase "quando falha, nada é registrado" deixa de valer, porque as tentativas falhas ficam registradas. A regra "todo Pedido está Pago" continua valendo.
- Um job de reconciliação consulta o PSP quando uma Tentativa fica pendente além do prazo.
