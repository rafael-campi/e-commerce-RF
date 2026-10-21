import { Matches } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class MetricsQueryDto {
  @Matches(DAY, { message: 'from deve estar no formato AAAA-MM-DD.' })
  from: string;

  @Matches(DAY, { message: 'to deve estar no formato AAAA-MM-DD.' })
  to: string;
}
