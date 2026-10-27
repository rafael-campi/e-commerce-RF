# 0002 — Estorno de Pedido pelo Administrador

- Status: aceita
- Data: 2026-10-21
- Relacionadas: 0001 (pagamentos via PSP próprio); ADR 0006 do payment-ledger-service (estornos no PSP)

## Contexto

O PSP já estorna pagamentos (`POST /v1/refunds`), mas a loja não tinha como desfazer uma venda. O glossário dizia que "todo Pedido está Pago".

## Decisão

- **Quem:** só o Administrador estorna, pela tela de pedidos (`POST /orders/:id/refund`).
- **Quanto:** o **Pedido inteiro**. O estorno parcial por item fica para depois. O PSP já aceita estornos parciais, mas a loja teria de decidir o que acontece com cada item.
- **Estoque:** os itens **voltam ao Estoque**. A loja não tem envio, então estornar desfaz a venda. Se um dia houver envio, essa regra precisa ser revista: item já enviado não volta sozinho.
- **Taxa:** a taxa do PSP **não volta**, como define a ADR 0006 do PSP. O valor inteiro sai do saldo da loja no PSP.
- **Fluxo:**
  1. O Pedido é travado e passa a `refund_pending` ("estornando") **antes** de chamar o gateway. Dois cliques não viram dois estornos, e a chave de idempotência (`order-<id>-refund`) é fixa.
  2. Se o gateway confirma, o Pedido vira `refunded` e o Estoque volta. Se ele recusa, o Pedido volta a `paid` e a resposta explica o motivo.
  3. Se o gateway não responde, o Pedido fica `refund_pending`. O webhook `refund.succeeded` ou `refund.failed` decide, e a reconciliação pede de novo, com a mesma chave, depois de 5 minutos.
- **Métricas:** Pedidos `refunded` saem da receita, da contagem de pedidos pagos e dos produtos mais vendidos. Enquanto o estorno está pendente, o Pedido ainda conta, porque o dinheiro ainda é da loja.

## Consequências

- O glossário passa a dizer que "todo Pedido foi pago; depois, pode ser Estornado", e ganha o termo **Estorno**.
- Pedidos de demonstração (`DEMO-…`) e pedidos aprovados pelo gateway local não existem no PSP. Com o PSP ligado, o estorno deles é recusado com uma explicação.
