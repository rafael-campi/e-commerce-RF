# Loja Prateleira

Loja online em que clientes montam carrinhos com produtos do catálogo e os pagam, e administradores mantêm o catálogo e acompanham os pedidos.

## Language

### Pessoas

**Cliente**:
Usuário com papel USER que compra na loja.
_Avoid_: comprador, consumidor

**Administrador**:
Usuário com papel ADMIN, que mantém o catálogo, os usuários, vê todos os pedidos e pode estorná-los.
_Avoid_: admin (na escrita formal), gerente

**Moderador**:
Usuário com papel MODERATOR; hoje tem exatamente as mesmas permissões de um Cliente.

### Catálogo

**Produto**:
Item à venda no catálogo, com nome único, descrição, preço e estoque.
_Avoid_: item (quando se fala do catálogo), mercadoria

**Estoque**:
Quantidade de unidades de um Produto disponíveis para venda; diminui quando uma Tentativa de pagamento é aberta e volta se ela não der certo ou se o Pedido for Estornado.
_Avoid_: inventário, saldo

**Esgotado**:
Produto com Estoque zero; aparece no catálogo, mas não pode ser colocado em um Carrinho.

### Compra

**Carrinho**:
Conjunto de itens (Produto + quantidade) de um Cliente que ainda não foi pago; um Cliente pode ter vários, e cada um é pago separadamente.
_Avoid_: cesta, sacola

**Item do carrinho**:
Um Produto dentro de um Carrinho, com a quantidade desejada (nunca acima do Estoque).

**Pagamento**:
O ato de pagar um Carrinho, feito por meio de uma Tentativa de pagamento; quando dá certo, resulta em um Pedido, e quando falha, o Carrinho continua aberto.
_Avoid_: usar "pagamento" para o registro resultante (isso é o Pedido)

**Tentativa de pagamento**:
Uma tentativa de pagar um Carrinho por um Método de pagamento, registrada no gateway (o PSP). Enquanto está pendente (ex.: Pix aguardando o cliente), o Estoque fica reservado e o Carrinho não pode ser alterado; termina paga (vira Pedido), expirada, cancelada ou recusada. Um Carrinho tem no máximo uma Tentativa pendente.
_Avoid_: cobrança, transação, intenção de pagamento

**Pedido**:
O registro de um Carrinho pago com sucesso, criado quando a Tentativa de pagamento dá certo: valor cobrado, método, referência do gateway, data e os itens do Carrinho. Todo Pedido foi pago; depois, pode ser Estornado.
_Avoid_: compra, venda, transação, ordem

**Estorno**:
Devolução do valor inteiro de um Pedido ao Cliente, pelo mesmo Método de pagamento, feita pelo Administrador. Os itens voltam ao Estoque e o Pedido passa a Estornado (enquanto o gateway não confirma, fica "estornando"). A taxa do gateway não é devolvida. Pedidos Estornados não contam como receita.
_Avoid_: reembolso, devolução (para o registro), cancelamento (que é de Tentativa de pagamento)

**Método de pagamento**:
Pix ou cartão de crédito.
