import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
@UseGuards(JwtGuard)
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: { id: string; email: string }) {
    return this.users.getMyProfile(user.id);
  }

  @Put('me')
  updateMe(
    @CurrentUser() user: { id: string; email: string },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.id, dto);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.users.searchByEmail(q);
  }

  @Get(':id')
  getProfile(
    @CurrentUser() user: { id: string; email: string },
    @Param('id') id: string,
  ) {
    return this.users.getPublicProfile(user.id, id);
  }
}
