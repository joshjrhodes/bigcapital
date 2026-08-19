import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RpwSalesTaxApplication } from './RpwSalesTax.application';
import {
  SetTransactionCountyDto,
  UpdateCountyTaxRateDto,
  UpdateSalesTaxSettingsDto,
} from './dtos/RpwSalesTax.dto';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';

/**
 * Ohio multi-county sales tax (RPW).
 *
 * Single-user system, so these routes need authentication but no per-ability
 * permission checks — that keeps the module free of edits to upstream's roles
 * enums, which is what makes it survive a rebase.
 */
@Controller('rpw/sales-tax')
@ApiTags('RPW Sales Tax')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class RpwSalesTaxController {
  constructor(private readonly application: RpwSalesTaxApplication) {}

  @Get('counties')
  @ApiOperation({ summary: 'Retrieves the Ohio county rate table.' })
  @ApiQuery({
    name: 'activeOnly',
    required: false,
    type: Boolean,
    description: 'Only the counties in the job-site picker.',
  })
  @ApiResponse({ status: 200, description: 'The county rate table.' })
  public getCounties(@Query('activeOnly') activeOnly?: string) {
    return this.application.getCounties(activeOnly === 'true');
  }

  @Put('counties/:id')
  @ApiOperation({
    summary: "Updates a county's rate, activation or verification state.",
  })
  @ApiResponse({ status: 200, description: 'The updated county.' })
  public updateCounty(
    @Param('id', ParseIntPipe) countyId: number,
    @Body() dto: UpdateCountyTaxRateDto,
  ) {
    return this.application.updateCounty(countyId, dto);
  }

  @Get('settings')
  @ApiOperation({ summary: 'Retrieves the sales tax switches.' })
  public getSettings() {
    return this.application.getSettings();
  }

  @Put('settings')
  @ApiOperation({
    summary: 'Updates the sales tax switches (collection on/off, default county).',
  })
  @ApiResponse({
    status: 400,
    description:
      'Collection cannot be enabled while an active county has an unverified rate.',
  })
  public updateSettings(@Body() dto: UpdateSalesTaxSettingsDto) {
    return this.application.updateSettings(dto);
  }

  @Post('transaction-county')
  @ApiOperation({
    summary: 'Records the job-site county of an estimate or invoice.',
  })
  public setTransactionCounty(@Body() dto: SetTransactionCountyDto) {
    return this.application.setTransactionCounty(dto);
  }

  @Get('transaction-county/:type/:id')
  @ApiOperation({ summary: 'Retrieves the job-site county of a document.' })
  public getTransactionCounty(
    @Param('type') transactionType: string,
    @Param('id', ParseIntPipe) transactionId: number,
  ) {
    return this.application.getTransactionCounty(transactionType, transactionId);
  }

  @Get('documents')
  @ApiOperation({
    summary:
      'Lists estimates and invoices with their job-site county, including the ' +
      'ones that still have none.',
  })
  @ApiQuery({ name: 'fromDate', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'toDate', required: false, example: '2026-12-31' })
  public getDocuments(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    const today = new Date();
    return this.application.getDocuments(
      fromDate || `${today.getFullYear()}-01-01`,
      toDate || `${today.getFullYear()}-12-31`,
    );
  }

  @Get('reports/county-summary')
  @ApiOperation({
    summary:
      'Sales and tax collected broken out by job-site county — the shape ODT ' +
      'wants for county-separated reporting.',
  })
  @ApiQuery({ name: 'fromDate', required: true, example: '2026-01-01' })
  @ApiQuery({ name: 'toDate', required: true, example: '2026-12-31' })
  public getCountySummary(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    const today = new Date();
    const from = fromDate || `${today.getFullYear()}-01-01`;
    const to = toDate || `${today.getFullYear()}-12-31`;

    return this.application.getCountySummary(from, to);
  }
}
