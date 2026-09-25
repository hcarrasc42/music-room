import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { QueueController } from './queue.controller.js';
import { QueueService } from './queue.service.js';

const mockQueueService = {
  getSuggestions: vi.fn(),
  suggest: vi.fn(),
  vote: vi.fn(),
  unvote: vi.fn(),
};

const mockJwtGuard = { canActivate: (_ctx: ExecutionContext) => true };

describe('QueueController', () => {
  let controller: QueueController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [{ provide: QueueService, useValue: mockQueueService }],
    })
      .overrideGuard(JwtGuard)
      .useValue(mockJwtGuard)
      .compile();
    controller = module.get(QueueController);
  });

  it('vote delegates to queueService.vote', async () => {
    mockQueueService.vote.mockResolvedValue({ id: 'v1' });
    const result = await controller.vote({ id: 'u1', email: 'a@b.com' }, 's1', undefined, undefined);
    expect(mockQueueService.vote).toHaveBeenCalled();
    expect(result).toEqual({ id: 'v1' });
  });
});
