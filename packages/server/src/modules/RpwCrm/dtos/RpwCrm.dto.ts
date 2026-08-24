import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddNoteDto {
  @IsString()
  @MinLength(1)
  @ApiProperty({ example: 'Called about the sanctuary install — wants a quote in March.' })
  body: string;
}

export class SetReferralSourceDto {
  @IsString()
  @MaxLength(255)
  @ApiProperty({ example: 'Referred by Dayton Event Group' })
  referralSource: string;
}

export class SetTaxExemptionDto {
  @ApiProperty({ example: true })
  isTaxExempt: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({ example: 'Church — Ohio STEC-B blanket certificate' })
  taxExemptionReason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @ApiPropertyOptional({
    description: 'Object-storage key of the exemption certificate, from POST /attachments',
  })
  taxExemptionCertificateKey?: string;
}

export class CreateFollowUpDto {
  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ description: 'Customer this is about' })
  contactId?: number;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ example: 'SaleEstimate' })
  referenceType?: string;

  @IsOptional()
  @IsInt()
  @ApiPropertyOptional({ example: 12 })
  referenceId?: number;

  @IsDateString()
  @ApiProperty({ example: '2026-09-01', description: 'The day it should surface' })
  dueOn: string;

  @IsString()
  @MaxLength(500)
  @ApiProperty({ example: 'Chase the Easter estimate' })
  note: string;
}

export class SnoozeFollowUpDto {
  @IsDateString()
  @ApiProperty({ example: '2026-09-08' })
  dueOn: string;
}
