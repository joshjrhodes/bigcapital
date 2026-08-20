import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommandEquipmentPurchaseDto {
  @IsIn(['section179', 'cogs'])
  @ApiProperty({ enum: ['section179', 'cogs'] })
  tag: 'section179' | 'cogs';

  @IsString()
  @MaxLength(255)
  @ApiProperty({ example: 'Chauvet Rogue R2X Wash (pair)' })
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  @ApiPropertyOptional({ example: 'SN-2024-88371 / SN-2024-88372' })
  serialNumber?: string;

  @IsNumber()
  @Min(0)
  @ApiProperty({ example: 2000 })
  amount: number;

  @IsDateString()
  @ApiProperty({ example: '2026-08-20' })
  purchasedOn: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({ example: 'Used gear from Dayton Stage Supply' })
  vendorName?: string;

  @IsOptional()
  @IsIn(['Expense', 'Bill'])
  @ApiPropertyOptional({ enum: ['Expense', 'Bill'] })
  referenceType?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 3 })
  referenceId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({
    description: 'Object-storage key of the bill of sale, from POST /attachments',
  })
  attachmentKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  @ApiPropertyOptional()
  notes?: string;
}

export class SetReserveRateDto {
  @IsNumber()
  @Min(1)
  @Max(60)
  @ApiProperty({ example: 25, description: 'Percent of net profit to reserve' })
  ratePercent: number;
}
