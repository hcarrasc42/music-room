import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

const mockEventsService = {
  create: vi.fn(),
  findPublic: vi.fn(),
  findOne: vi.fn(),
  update: vi.fn(),
  close: vi.fn(),
  invite: vi.fn(),
};

const mockJwtGuard = { canActivate: (_ctx: ExecutionContext) => true };

describe('EventsController', () => {
  let controller: EventsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [{ provide: EventsService, useValue: mockEventsService }],
    })
      .overrideGuard(JwtGuard)
      .useValue(mockJwtGuard)
      .compile();
    controller = module.get(EventsController);
  });

  it('create delegates to eventsService.create', async () => {
    mockEventsService.create.mockResolvedValue({ id: 'ev1' });
    const result = await controller.create({ id: 'u1', email: 'a@b.com' }, { name: 'Party' });
    expect(mockEventsService.create).toHaveBeenCalledWith('u1', { name: 'Party' });
    expect(result).toEqual({ id: 'ev1' });
  });
});
