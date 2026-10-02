import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Like, Not, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity.js';
import { normalizeUsername } from '../common/validation/username.js';
import { Friendship } from './entities/friendship.entity.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { UserProfile } from './entities/user-profile.entity.js';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string | null;
}

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
      username: user?.username ?? '',
      // false si la cuenta se creó con Google: puede crear una sin dar la actual
      hasPassword: !!user?.passwordHash,
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
    const { username: rawUsername, ...profileFields } = dto;
    if (rawUsername !== undefined) {
      const username = normalizeUsername(rawUsername);
      const taken = await this.users.findOneBy({ username, id: Not(userId) });
      if (taken) throw new BadRequestException('Ese nombre de usuario ya está cogido');
      await this.users.update(userId, { username });
    }
    await this.profiles.upsert({ userId, ...profileFields }, ['userId']);
    return this.getMyProfile(userId);
  }

  // Datos públicos mínimos para mostrar a otros usuarios (nunca el email)
  private async summaries(ids: string[]): Promise<Map<string, UserSummary>> {
    if (!ids.length) return new Map();
    const [users, profiles] = await Promise.all([
      this.users.find({ where: { id: In(ids) }, select: { id: true, username: true } }),
      this.profiles.findBy({ userId: In(ids) }),
    ]);
    const names = new Map(profiles.map((p) => [p.userId, p.displayName]));
    return new Map(users.map((u) => [u.id, { id: u.id, username: u.username, displayName: names.get(u.id) || null }]));
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

    const target = await this.users.findOneBy({ id: targetId });
    const result: Record<string, unknown> = {
      userId: targetId,
      username: target?.username,
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

  // Busca por el principio del nombre de usuario ("has" encuentra a hasi42), sin incluirte a ti
  async searchByUsername(requesterId: string, q: string) {
    const term = normalizeUsername(q ?? '');
    if (!term) return [];
    const escaped = term.replace(/[\\%_]/g, '\\$&'); // _ es válido en usernames, pero en LIKE es comodín
    const users = await this.users.find({
      where: { username: Like(`${escaped}%`), id: Not(requesterId) },
      select: { id: true },
      order: { username: 'ASC' },
      take: 10,
    });
    const found = await this.summaries(users.map((u) => u.id));
    return users.map((u) => found.get(u.id)!);
  }

  async sendFriendRequest(userId: string, friendId: string) {
    const friend = await this.users.findOneBy({ id: friendId });
    if (!friend) throw new NotFoundException('Usuario no encontrado');
    if (friend.id === userId) throw new BadRequestException('No puedes añadirte a ti mismo');

    const existing = await this.friendships.findOne({
      where: [
        { userId, friendId: friend.id },
        { userId: friend.id, friendId: userId },
      ],
    });
    if (existing) {
      throw new BadRequestException(existing.status === 'accepted' ? 'Ya sois amigos' : 'Ya hay una solicitud pendiente');
    }

    return this.friendships.save({ userId, friendId: friend.id, status: 'pending' });
  }

  // Cada amistad con los datos públicos de la otra persona
  private async withOtherUser(userId: string, list: Friendship[]) {
    const otherId = (f: Friendship) => (f.userId === userId ? f.friendId : f.userId);
    const users = await this.summaries(list.map(otherId));
    return list
      .filter((f) => users.has(otherId(f)))
      .map((f) => ({ id: f.id, status: f.status, user: users.get(otherId(f))! }));
  }

  async getFriends(userId: string) {
    const list = await this.friendships.find({
      where: [
        { userId, status: 'accepted' },
        { friendId: userId, status: 'accepted' },
      ],
    });
    return this.withOtherUser(userId, list);
  }

  async getPendingRequests(userId: string) {
    const list = await this.friendships.find({ where: { friendId: userId, status: 'pending' } });
    return this.withOtherUser(userId, list);
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
