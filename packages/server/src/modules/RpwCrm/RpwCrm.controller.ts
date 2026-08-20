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
import { RpwCrmApplication } from './RpwCrm.application';
import {
  AddNoteDto,
  CreateFollowUpDto,
  SetReferralSourceDto,
  SnoozeFollowUpDto,
} from './dtos/RpwCrm.dto';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';

/**
 * Lightweight CRM (RPW): notes, timeline and follow-ups.
 */
@Controller('rpw/crm')
@ApiTags('RPW CRM')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard)
export class RpwCrmController {
  constructor(private readonly application: RpwCrmApplication) {}

  @Get('customers')
  @ApiOperation({ summary: 'Customers with their referral source.' })
  public listCustomers() {
    return this.application.listCustomers();
  }

  @Get('customers/:id/timeline')
  @ApiOperation({
    summary: 'Notes and auto-logged history for a customer, newest first.',
  })
  public timeline(@Param('id', ParseIntPipe) contactId: number) {
    return this.application.getTimeline(contactId);
  }

  @Post('customers/:id/notes')
  @ApiOperation({ summary: 'Adds a note to a customer.' })
  public addNote(
    @Param('id', ParseIntPipe) contactId: number,
    @Body() dto: AddNoteDto,
  ) {
    return this.application.addNote(contactId, dto.body);
  }

  @Delete('notes/:id')
  @ApiOperation({ summary: 'Deletes a note.' })
  public deleteNote(@Param('id', ParseIntPipe) noteId: number) {
    return this.application.deleteNote(noteId);
  }

  @Put('customers/:id/referral-source')
  @ApiOperation({ summary: 'Records who referred this customer.' })
  public setReferralSource(
    @Param('id', ParseIntPipe) contactId: number,
    @Body() dto: SetReferralSourceDto,
  ) {
    return this.application.setReferralSource(contactId, dto.referralSource);
  }

  @Get('customers/:id/follow-ups')
  @ApiOperation({ summary: 'Follow-ups for one customer.' })
  public followUpsForContact(@Param('id', ParseIntPipe) contactId: number) {
    return this.application.followUpsForContact(contactId);
  }

  @Get('follow-ups')
  @ApiOperation({
    summary: 'Due and upcoming follow-ups. Overdue items stay in the due list.',
  })
  @ApiQuery({ name: 'today', required: false, example: '2026-08-20' })
  public followUps(@Query('today') today?: string) {
    return this.application.followUpBoard(
      today || new Date().toISOString().slice(0, 10),
    );
  }

  @Post('follow-ups')
  @ApiOperation({ summary: 'Creates a follow-up.' })
  public createFollowUp(@Body() dto: CreateFollowUpDto) {
    return this.application.createFollowUp(dto);
  }

  @Put('follow-ups/:id/done')
  @ApiOperation({ summary: 'Marks a follow-up as handled.' })
  public completeFollowUp(@Param('id', ParseIntPipe) id: number) {
    return this.application.completeFollowUp(id);
  }

  @Put('follow-ups/:id/snooze')
  @ApiOperation({ summary: 'Pushes a follow-up to a later date.' })
  public snoozeFollowUp(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SnoozeFollowUpDto,
  ) {
    return this.application.snoozeFollowUp(id, dto.dueOn);
  }

  @Delete('follow-ups/:id')
  @ApiOperation({ summary: 'Deletes a follow-up.' })
  public deleteFollowUp(@Param('id', ParseIntPipe) id: number) {
    return this.application.deleteFollowUp(id);
  }

  @Post('follow-ups/send-digest')
  @ApiOperation({
    summary:
      'Sends the daily digest now. It runs itself at 7am; this exists so it ' +
      'can be tested without waiting until 7am.',
  })
  public sendDigest() {
    return this.application.sendDigestNow();
  }
}
