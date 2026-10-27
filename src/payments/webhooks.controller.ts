import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { GatewayEvent, PaymentsService } from './payments.service';
import { verifyPspSignature } from './webhook-signature';

/**
 * Recebe os eventos do PSP. Público: quem prova a origem é a assinatura
 * HMAC sobre o corpo cru, não um token de usuário.
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly paymentService: PaymentsService) {}

  @Post('payments')
  @HttpCode(HttpStatus.OK)
  async payments(
    @Req() req: RawBodyRequest<Request>,
    @Headers('psp-signature') signature: string | undefined,
  ) {
    const secret = process.env.PSP_WEBHOOK_SECRET;
    const raw = req.rawBody?.toString('utf8') ?? '';
    // sem segredo configurado, nenhuma entrega é aceita
    if (!secret || !verifyPspSignature(signature, raw, secret)) {
      throw new UnauthorizedException('Assinatura do webhook inválida.');
    }

    const event = req.body as Partial<GatewayEvent>;
    if (!event?.id || !event.type || !event.data?.object?.id) {
      throw new BadRequestException('Evento malformado.');
    }
    await this.paymentService.handleGatewayEvent(event as GatewayEvent);
    return { received: true };
  }
}
