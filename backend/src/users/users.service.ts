import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { Friendship } from './entities/friendship.entity.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserProfile } from './entities/user-profile.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserProfile) private profiles: Repository<UserProfile>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Friendship) private friendships: Repository<Friendship>,
  ) {}

  async getMyProfile(userId: string) {
    let profile = await this.profiles.findOneBy({ userId });
    if (!profile) {
      profile = await this.profiles.save({ userId });
    }
    const user = await this.users.findOneBy({ id: userId });
    return {
      id: userId,
      email: user?.email ?? '',
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      city: profile.city,
      bioVisibility: profile.bioVisibility,
      musicGenres: profile.musicGenres,
      favoriteArtists: profile.favoriteArtists,
      musicVisibility: profile.musicVisibility,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    await this.profiles.upsert({ userId, ...dto }, ['userId']);
    return this.profiles.findOneBy({ userId });
  }

  async getPublicProfile(requesterId: string, targetId: string) {
    const profile = await this.profiles.findOneBy({ userId: targetId });
    if (!profile) return { userId: targetId };

    const areFriends = await this.friendships.findOne({
      where: [
        { userId: requesterId, friendId: targetId, status: 'accepted' },
        { userId: targetId, friendId: requesterId, status: 'accepted' },
      ],
    });

    const result: Record<string, unknown> = {
      userId: targetId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    };

    if (profile.bioVisibility === 'public' || (profile.bioVisibility === 'friends' && areFriends)) {
      result.bio = profile.bio;
      result.city = profile.city;
    }

    if (profile.musicVisibility === 'public' || (profile.musicVisibility === 'friends' && areFriends)) {
      result.musicGenres = profile.musicGenres;
      result.favoriteArtists = profile.favoriteArtists;
    }

    return result;
  }

  async searchByEmail(email: string) {
    const user = await this.users.findOne({
      where: { email },
      select: { id: true, email: true },
    });
    if (!user) return null;
    const profile = await this.profiles.findOneBy({ userId: user.id });
    return { id: user.id, email: user.email, displayName: profile?.displayName ?? null };
  }

  async sendFriendRequest(userId: string, friendEmail: string) {
    const friend = await this.users.findOneBy({ email: friendEmail });
    if (!friend) throw new Error('User not found');
    if (friend.id === userId) throw new Error('Cannot add yourself');

    const existing = await this.friendships.findOne({
      where: [
        { userId, friendId: friend.id },
        { userId: friend.id, friendId: userId },
      ],
    });
    if (existing) throw new Error('Friendship already exists');

    return this.friendships.save({ userId, friendId: friend.id, status: 'pending' });
  }

  async getFriends(userId: string) {
    return this.friendships.find({
      where: [
        { userId, status: 'accepted' },
        { friendId: userId, status: 'accepted' },
      ],
    });
  }

  async getPendingRequests(userId: string) {
    return this.friendships.find({ where: { friendId: userId, status: 'pending' } });
  }

  async acceptRequest(userId: string, friendshipId: string) {
    const fs = await this.friendships.findOneBy({ id: friendshipId, friendId: userId });
    if (!fs) throw new Error('Request not found');
    await this.friendships.update(friendshipId, { status: 'accepted' });
    return { message: 'Friend request accepted' };
  }

  async removeFriend(userId: string, friendshipId: string) {
    const fs = await this.friendships.findOne({
      where: [
        { id: friendshipId, userId },
        { id: friendshipId, friendId: userId },
      ],
    });
    if (!fs) throw new Error('Friendship not found');
    await this.friendships.delete(friendshipId);
    return { message: 'Friendship removed' };
  }
}
