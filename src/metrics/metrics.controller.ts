import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { UserType } from '../enums/user-types.enum';
import { MetricsQueryDto } from './metrics-query.dto';
import { MetricsService } from './metrics.service';

@Controller('admin/metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Roles(UserType.ADMIN)
  summary(@Query() { from, to }: MetricsQueryDto) {
    return this.metrics.summary(from, to);
  }
}
