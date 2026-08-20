import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RpwPdfDesignerApplication } from './RpwPdfDesigner.application';
import {
  CreateDesignDto,
  PreviewDesignDto,
  SaveDesignDto,
} from './dtos/RpwPdfDesign.dto';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';

/**
 * Visual PDF designs (RPW).
 *
 * Single-user system, so these routes authenticate but do not carry per-ability
 * permissions — which keeps the module clear of upstream's roles enums.
 */
@Controller('rpw/pdf-designer')
@ApiTags('RPW PDF Designer')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class RpwPdfDesignerController {
  constructor(private readonly application: RpwPdfDesignerApplication) {}

  @Get('designs')
  @ApiOperation({ summary: 'Lists the PDF designs.' })
  @ApiQuery({ name: 'resource', required: false, enum: ['SaleInvoice', 'SaleEstimate'] })
  public listDesigns(@Query('resource') resource?: string) {
    return this.application.listDesigns(resource);
  }

  @Get('designs/:id')
  @ApiOperation({ summary: 'Retrieves a design and its current template.' })
  public getDesign(@Param('id', ParseIntPipe) designId: number) {
    return this.application.getDesign(designId);
  }

  @Get('designs/:id/versions')
  @ApiOperation({ summary: 'Lists a design\'s saved versions, newest first.' })
  public listVersions(@Param('id', ParseIntPipe) designId: number) {
    return this.application.listVersions(designId);
  }

  @Post('designs')
  @ApiOperation({
    summary: 'Creates a design, starting from the stock layout unless one is given.',
  })
  public createDesign(@Body() dto: CreateDesignDto) {
    return this.application.createDesign(dto.resource, dto.name, dto.template);
  }

  @Put('designs/:id')
  @ApiOperation({ summary: 'Saves the design as a new version.' })
  public saveDesign(
    @Param('id', ParseIntPipe) designId: number,
    @Body() dto: SaveDesignDto,
  ) {
    return this.application.saveDesign(designId, dto.template, dto.note);
  }

  @Post('designs/:id/versions/:versionId/restore')
  @ApiOperation({ summary: 'Rolls the design back to an earlier version.' })
  public restoreVersion(
    @Param('id', ParseIntPipe) designId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.application.restoreVersion(designId, versionId);
  }

  @Put('designs/:id/activate')
  @ApiOperation({
    summary: 'Uses this design for its document type from now on.',
  })
  public activate(@Param('id', ParseIntPipe) designId: number) {
    return this.application.activateDesign(designId);
  }

  @Put('designs/:id/deactivate')
  @ApiOperation({
    summary: 'Stops using this design, returning to the built-in layout.',
  })
  public deactivate(@Param('id', ParseIntPipe) designId: number) {
    return this.application.deactivateDesign(designId);
  }

  @Post('designs/ensure-stock')
  @ApiOperation({
    summary:
      'Creates a stock design per document type if none exists. Idempotent, ' +
      'and leaves them inactive — the coded template stays in force until a ' +
      'design is explicitly activated.',
  })
  public ensureStock() {
    return this.application.ensureStockDesigns();
  }

  @Get('stock-template')
  @ApiOperation({ summary: 'The built-in layout as pdfme template JSON.' })
  @ApiQuery({ name: 'resource', required: false, enum: ['SaleInvoice', 'SaleEstimate'] })
  public stockTemplate(@Query('resource') resource = 'SaleInvoice') {
    return this.application.getStockTemplate(resource);
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Renders a preview PDF from a template, with real or sample data.',
  })
  @ApiResponse({ status: 200, description: 'A PDF document.' })
  public async preview(
    @Body() dto: PreviewDesignDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.application.preview(dto);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdf.length,
      'Content-Disposition': 'inline; filename="design-preview.pdf"',
    });
    res.send(pdf);
  }

  @Post('designs/:id/preview')
  @ApiOperation({ summary: 'Renders a preview of a saved design.' })
  public async previewDesign(
    @Param('id', ParseIntPipe) designId: number,
    @Body() dto: PreviewDesignDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.application.preview({ ...dto, designId });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdf.length,
      'Content-Disposition': 'inline; filename="design-preview.pdf"',
    });
    res.send(pdf);
  }
}
