import { IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDesignDto {
  @IsIn(['SaleInvoice', 'SaleEstimate'])
  @ApiProperty({ enum: ['SaleInvoice', 'SaleEstimate'] })
  resource: string;

  @IsString()
  @MaxLength(128)
  @ApiProperty({ example: 'RPW Stock Layout' })
  name: string;

  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description: 'pdfme template JSON. Omit to start from the stock layout.',
  })
  template?: Record<string, any>;
}

export class SaveDesignDto {
  @IsObject()
  @ApiProperty({ description: 'pdfme template JSON: { basePdf, schemas }' })
  template: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({ example: 'Moved the logo, widened the description column' })
  note?: string;
}

export class PreviewDesignDto {
  @IsOptional()
  @IsObject()
  @ApiPropertyOptional({
    description:
      'Template to preview. Omit to preview the design as last saved.',
  })
  template?: Record<string, any>;

  @IsOptional()
  @ApiPropertyOptional({
    description:
      'Document to preview with. Omit for representative sample data.',
  })
  documentId?: number;

  @IsOptional()
  @IsIn(['SaleInvoice', 'SaleEstimate'])
  @ApiPropertyOptional({ enum: ['SaleInvoice', 'SaleEstimate'] })
  resource?: string;
}
