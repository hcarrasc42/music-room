import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

const mockUsersService = {
  getMyProfile: vi.fn(),
  updateProfile: vi.fn(),
  getPublicProfile: vi.fn(),
  searchByEmail: vi.fn(),
};

const mockJwtGuard = { canActivate: (_ctx: ExecutionContext) => true };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    })
      .overrideGuard(JwtGuard)
      .useValue(mockJwtGuard)
      .compile();
    controller = module.get(UsersController);
  });

  it('getMe returns my profile', async () => {
    mockUsersService.getMyProfile.mockResolvedValue({ userId: '1' });
    const result = await controller.getMe({ id: '1', email: 'a@b.com' });
    expect(mockUsersService.getMyProfile).toHaveBeenCalledWith('1');
    expect(result).toEqual({ userId: '1' });
  });
});
