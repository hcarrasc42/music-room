import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { EventsService } from './events.service.js';

@Controller('events')
@UseGuards(JwtGuard)
export class EventsController {
  constructor(private events: EventsService) {}

  @Post()
  create(@CurrentUser() u: { id: string; email: string }, @Body() dto: CreateEventDto) {
    return this.events.create(u.id, dto);
  }

  @Get()
  findAll() {
    return this.events.findPublic();
  }

  @Get(':id')
  findOne(@CurrentUser() u: { id: string }, @Param('id') id: string) {
    return this.events.findOne(id, u.id);
  }

  @Put(':id')
  update(@CurrentUser() u: { id: string }, @Param('id') id: string, @Body() dto: CreateEventDto) {
    return this.events.update(u.id, id, dto);
  }

  @Delete(':id')
  close(@CurrentUser() u: { id: string }, @Param('id') id: string) {
    return this.events.close(u.id, id);
  }

  @Post(':id/invites')
  invite(
    @CurrentUser() u: { id: string },
    @Param('id') id: string,
    @Body('email') email: string,
  ) {
    return this.events.invite(u.id, id, email);
  }
}
