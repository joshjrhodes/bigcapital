import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RpwTaxableTransactionType } from '../RpwSalesTax.constants';

export class UpdateCountyTaxRateDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(20)
  @ApiPropertyOptional({
    description: 'Combined state + county rate as a percentage, e.g. 7.5',
    example: 7.5,
  })
  combinedRate?: number;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description: 'Whether this county appears in the job-site picker',
  })
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description:
      'Mark the rate as checked against tax.ohio.gov. Sales tax cannot be ' +
      'collected for a county whose rate nobody has verified.',
  })
  verified?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  @ApiPropertyOptional({ description: 'Where the rate was checked' })
  sourceUrl?: string;
}

export class SetTransactionCountyDto {
  @IsEnum(RpwTaxableTransactionType)
  @ApiProperty({
    enum: RpwTaxableTransactionType,
    description: 'Which kind of document the county belongs to',
  })
  transactionType: RpwTaxableTransactionType;

  @IsInt()
  @ApiProperty({ description: 'The estimate or invoice id', example: 12 })
  transactionId: number;

  @IsInt()
  @ApiProperty({ description: 'County id from the county rate table', example: 29 })
  countyId: number;
}

export class UpdateSalesTaxSettingsDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({
    description:
      'Turn sales tax collection on. Only do this once the Ohio vendor\'s ' +
      'licence is approved — the API refuses while any active county is unverified.',
  })
  collectionEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({
    description: 'County pre-selected on new estimates and invoices',
  })
  defaultCountyId?: number;
}
