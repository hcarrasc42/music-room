import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module.js';
import { User } from '../auth/entities/user.entity.js';
import { FriendsController } from './friends.controller.js';
import { UserProfile } from './entities/user-profile.entity.js';
import { Friendship } from './entities/friendship.entity.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([UserProfile, Friendship, User]), AuthModule],
  controllers: [UsersController, FriendsController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
