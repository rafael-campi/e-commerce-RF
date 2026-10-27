import { CreateDateColumn, Entity, PrimaryColumn, Column } from 'typeorm';

/** Eventos do gateway já aplicados: a entrega é "pelo menos uma vez". */
@Entity('processed_webhook_events')
export class ProcessedWebhookEventEntity {
  @PrimaryColumn({ type: 'varchar', length: 64 })
  eventId: string;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @CreateDateColumn()
  receivedAt: Date;
}
