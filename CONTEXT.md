# Loja Prateleira

Loja online em que clientes montam carrinhos com produtos do catálogo e os pagam, e administradores mantêm o catálogo e acompanham os pedidos.

## Language

### Pessoas

**Cliente**:
Usuário com papel USER que compra na loja.
_Avoid_: comprador, consumidor

**Administrador**:
Usuário com papel ADMIN, que mantém o catálogo, os usuários e vê todos os pedidos.
_Avoid_: admin (na escrita formal), gerente

**Moderador**:
Usuário com papel MODERATOR; hoje tem exatamente as mesmas permissões de um Cliente.

### Catálogo

**Produto**:
Item à venda no catálogo, com nome único, descrição, preço e estoque.
_Avoid_: item (quando se fala do catálogo), mercadoria

**Estoque**:
Quantidade de unidades de um Produto disponíveis para venda; só diminui quando um Carrinho é pago.
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
O ato de pagar um Carrinho; quando dá certo, resulta em um Pedido, e quando falha, nada é registrado e o Carrinho continua aberto.
_Avoid_: usar "pagamento" para o registro resultante (isso é o Pedido)

**Pedido**:
O registro de um Carrinho pago com sucesso: valor cobrado, método, referência do gateway, data e os itens do Carrinho. Todo Pedido está Pago.
_Avoid_: compra, venda, transação, ordem

**Método de pagamento**:
Pix ou cartão de crédito.
