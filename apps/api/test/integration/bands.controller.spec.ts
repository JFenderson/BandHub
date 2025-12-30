import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { BandsController } from '../../src/modules/bands/bands.controller';
import { BandsService } from '../../src/modules/bands/bands.service';
import { FeaturedRecommendationsService } from '../../src/modules/bands/featured-recommendations.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { PaginatedResponse } from '@hbcu-band-hub/shared-types';

const mockBandsService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const mockFeaturedRecommendationsService = {
  getRecommendations: jest.fn().mockResolvedValue([{ id: 'rec-1' }]),
};

class AllowAllGuard {
  canActivate() {
    return true;
  }
}

describe('BandsController (integration)', () => {
  let app: INestApplication;
  let controller: BandsController;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BandsController],
      providers: [
        { provide: BandsService, useValue: mockBandsService },
        { provide: FeaturedRecommendationsService, useValue: mockFeaturedRecommendationsService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useClass(AllowAllGuard)
      .overrideGuard(RolesGuard)
      .useClass(AllowAllGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    controller = app.get(BandsController);
  });

  afterAll(async () => {
    await app.close();
  });

  it('responds with paginated data on GET /bands', async () => {
    mockBandsService.findAll.mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });

const response = await controller.findAll({ page: 1, limit: 20 }) as PaginatedResponse<unknown>;

    expect(response.meta.page).toBe(1);
    expect(mockBandsService.findAll).toHaveBeenCalledWith({ page: 1, limit: 20, search: undefined });
  });

  it('bubbles service errors for single resource lookups', async () => {
    mockBandsService.findById.mockRejectedValue(new Error('not found'));

    await expect(controller.findOne('unknown')).rejects.toBeInstanceOf(Error);
  });
});
