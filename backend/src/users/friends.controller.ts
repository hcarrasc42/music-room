import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';

@Controller('friends')
@UseGuards(JwtGuard)
export class FriendsController {
  constructor(private users: UsersService) {}

  @Post()
  sendRequest(
    @CurrentUser() user: { id: string },
    @Body('email') email: string,
  ) {
    return this.users.sendFriendRequest(user.id, email);
  }

  @Get()
  getFriends(@CurrentUser() user: { id: string }) {
    return this.users.getFriends(user.id);
  }

  @Get('requests')
  getRequests(@CurrentUser() user: { id: string }) {
    return this.users.getPendingRequests(user.id);
  }

  @Put(':id/accept')
  accept(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.users.acceptRequest(user.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.users.removeFriend(user.id, id);
  }
}
