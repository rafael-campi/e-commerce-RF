import { PaymentEntity } from './entities/payment.entity';

/**
 * Pedido como o admin vê (GET /orders). Precisa das relações user, carts e
 * carts.cartItem carregadas.
 */
export function toOrderView(payment: PaymentEntity) {
  const [cart] = payment.carts;
  return {
    id: payment.id,
    amount: payment.amount,
    paymentMethod: payment.payment_method,
    status: payment.payment_status,
    gatewayReference: payment.gatewayReference,
    createdAt: payment.createdAt,
    refundedAt: payment.refundedAt,
    cartId: cart?.id ?? null,
    customer: {
      id: payment.user.id,
      email: payment.user.email,
      firstName: payment.user.firstName,
      lastName: payment.user.lastName,
    },
    items: (cart?.cartItem ?? []).map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
    })),
  };
}

export const ORDER_RELATIONS = ['user', 'carts', 'carts.cartItem'];
