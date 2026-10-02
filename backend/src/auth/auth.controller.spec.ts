import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtGuard } from './guards/jwt.guard.js';

const mockAuthService = {
  register: vi.fn(),
  login: vi.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    })
      .overrideGuard(JwtGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AuthController);
  });

  it('register calls authService.register', async () => {
    mockAuthService.register.mockResolvedValue({ message: 'ok' });
    const result = await controller.register({ email: 'a@b.com', password: '12345678', username: 'pepe' });
    expect(mockAuthService.register).toHaveBeenCalledWith('a@b.com', '12345678', 'pepe');
    expect(result).toEqual({ message: 'ok' });
  });

  it('login calls authService.login', async () => {
    mockAuthService.login.mockResolvedValue({ access_token: 'tok', refresh_token: 'ref' });
    const result = await controller.login({ email: 'a@b.com', password: '12345678' });
    expect(result.access_token).toBe('tok');
  });
});
