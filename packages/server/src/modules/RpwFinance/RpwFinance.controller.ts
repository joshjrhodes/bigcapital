import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TaxReserveService } from './TaxReserve.service';
import { EquipmentPurchasesService } from './EquipmentPurchases.service';
import { TaxCalendarService } from './TaxCalendar.service';
import {
  CommandEquipmentPurchaseDto,
  SetReserveRateDto,
} from './dtos/RpwFinance.dto';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';

/**
 * RPW finance extensions (Phase 5): the tax reserve, the equipment register,
 * and the estimated-payment calendar.
 */
@Controller('rpw/finance')
@ApiTags('RPW Finance')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class RpwFinanceController {
  constructor(
    private readonly taxReserve: TaxReserveService,
    private readonly equipment: EquipmentPurchasesService,
    private readonly taxCalendar: TaxCalendarService,
  ) {}

  @Get('tax-reserve')
  @ApiOperation({
    summary:
      'Reserve target (rate × YTD cash-basis net profit) vs what the reserve ' +
      'account actually holds.',
  })
  @ApiQuery({ name: 'asOf', required: false, example: '2026-08-20' })
  public getTaxReserve(@Query('asOf') asOf?: string) {
    return this.taxReserve.getState(asOf);
  }

  @Put('tax-reserve/rate')
  @ApiOperation({ summary: 'Changes the reserve rate (default 25%).' })
  public async setReserveRate(@Body() dto: SetReserveRateDto) {
    await this.taxReserve.setReserveRate(dto.ratePercent);
    return this.taxReserve.getState();
  }

  @Get('tax-calendar')
  @ApiOperation({ summary: 'Upcoming federal/Ohio estimated-payment dates.' })
  public getTaxCalendar() {
    return this.taxCalendar.upcoming();
  }

  @Get('equipment')
  @ApiOperation({ summary: 'The equipment purchase register.' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  public listEquipment(@Query('year') year?: string) {
    return this.equipment.list(year ? Number(year) : undefined);
  }

  @Get('equipment/report')
  @ApiOperation({
    summary:
      'CPA-ready equipment report: totals by treatment, and what is missing ' +
      'a serial or bill of sale.',
  })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  public equipmentReport(@Query('year') year?: string) {
    return this.equipment.report(year ? Number(year) : new Date().getFullYear());
  }

  @Post('equipment')
  @ApiOperation({ summary: 'Registers an equipment purchase.' })
  public createEquipment(@Body() dto: CommandEquipmentPurchaseDto) {
    return this.equipment.create(dto);
  }

  @Put('equipment/:id')
  @ApiOperation({ summary: 'Updates an equipment purchase.' })
  public updateEquipment(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CommandEquipmentPurchaseDto,
  ) {
    return this.equipment.update(id, dto);
  }

  @Delete('equipment/:id')
  @ApiOperation({ summary: 'Removes an equipment purchase from the register.' })
  public deleteEquipment(@Param('id', ParseIntPipe) id: number) {
    return this.equipment.remove(id);
  }
}
