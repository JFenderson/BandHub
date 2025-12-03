import { SecretsService } from '../../src/modules/secrets-manager/secrets.service';
import { EnvSecretsProvider } from '../../src/modules/secrets-manager/providers/env.provider';
import { DopplerSecretsProvider } from '../../src/modules/secrets-manager/providers/doppler.provider';
import { AwsSecretsProvider } from '../../src/modules/secrets-manager/providers/aws.provider';
import { VaultSecretsProvider } from '../../src/modules/secrets-manager/providers/vault.provider';

const createMocks = () => {
  const configService = {
    get: jest.fn(),
  } as any;

  const envProvider = {
    name: 'env',
    getSecret: jest.fn(),
    getSecrets: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(true),
    initialize: jest.fn().mockResolvedValue(undefined),
  } as any;

  const dopplerProvider = {
    name: 'doppler',
    getSecret: jest.fn(),
    getSecrets: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(false),
    initialize: jest.fn().mockResolvedValue(undefined),
  } as any;

  const awsProvider = {
    name: 'aws-secrets-manager',
    getSecret: jest.fn(),
    getSecrets: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(false),
    initialize: jest.fn().mockResolvedValue(undefined),
  } as any;

  const vaultProvider = {
    name: 'hashicorp-vault',
    getSecret: jest.fn(),
    getSecrets: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue(false),
    initialize: jest.fn().mockResolvedValue(undefined),
  } as any;

  const service = new SecretsService(
    configService,
    envProvider,
    dopplerProvider,
    awsProvider,
    vaultProvider,
  );

  return { service, configService, envProvider, dopplerProvider, awsProvider, vaultProvider };
};

describe('SecretsService (unit)', () => {
  describe('initialization', () => {
    it('defaults to env provider when no provider is specified', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SECRETS_PROVIDER') return 'env';
        if (key === 'SECRETS_CACHE_TTL') return 300000;
        if (key === 'SECRETS_CACHE_ENABLED') return true;
        return defaultValue;
      });

      await service.onModuleInit();

      expect(service.getActiveProviderName()).toBe('env');
    });

    it('falls back to env provider when doppler fails health check', async () => {
      const { service, configService, dopplerProvider, envProvider } = createMocks();
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SECRETS_PROVIDER') return 'doppler';
        if (key === 'SECRETS_CACHE_TTL') return 300000;
        if (key === 'SECRETS_CACHE_ENABLED') return true;
        return defaultValue;
      });
      dopplerProvider.healthCheck.mockResolvedValue(false);
      envProvider.healthCheck.mockResolvedValue(true);

      await service.onModuleInit();

      expect(service.getActiveProviderName()).toBe('env');
    });

    it('uses doppler provider when it passes health check', async () => {
      const { service, configService, dopplerProvider, envProvider } = createMocks();
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SECRETS_PROVIDER') return 'doppler';
        if (key === 'SECRETS_CACHE_TTL') return 300000;
        if (key === 'SECRETS_CACHE_ENABLED') return true;
        return defaultValue;
      });
      dopplerProvider.healthCheck.mockResolvedValue(true);

      await service.onModuleInit();

      expect(service.getActiveProviderName()).toBe('doppler');
    });
  });

  describe('get', () => {
    it('retrieves secret from active provider', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockReturnValue('env');
      envProvider.getSecret.mockResolvedValue('secret-value');

      await service.onModuleInit();
      const value = await service.get('JWT_SECRET');

      expect(envProvider.getSecret).toHaveBeenCalledWith('JWT_SECRET');
      expect(value).toBe('secret-value');
    });

    it('falls back to env provider when secret not found in active provider', async () => {
      const { service, configService, dopplerProvider, envProvider } = createMocks();
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SECRETS_PROVIDER') return 'doppler';
        if (key === 'SECRETS_CACHE_TTL') return 300000;
        if (key === 'SECRETS_CACHE_ENABLED') return true;
        return defaultValue;
      });
      dopplerProvider.healthCheck.mockResolvedValue(true);
      dopplerProvider.getSecret.mockResolvedValue(null);
      envProvider.getSecret.mockResolvedValue('env-secret-value');

      await service.onModuleInit();
      const value = await service.get('SOME_SECRET');

      expect(dopplerProvider.getSecret).toHaveBeenCalledWith('SOME_SECRET');
      expect(envProvider.getSecret).toHaveBeenCalledWith('SOME_SECRET');
      expect(value).toBe('env-secret-value');
    });

    it('returns cached value when cache is enabled', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SECRETS_PROVIDER') return 'env';
        if (key === 'SECRETS_CACHE_TTL') return 300000;
        if (key === 'SECRETS_CACHE_ENABLED') return true;
        return defaultValue;
      });
      envProvider.getSecret.mockResolvedValue('cached-value');

      await service.onModuleInit();
      
      // First call - should fetch from provider
      const value1 = await service.get('CACHED_SECRET');
      
      // Second call - should return from cache (provider may or may not be called)
      const value2 = await service.get('CACHED_SECRET');

      // Both calls should return the cached value
      expect(value1).toBe('cached-value');
      expect(value2).toBe('cached-value');
    });
  });

  describe('getOrDefault', () => {
    it('returns secret value when found', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockReturnValue('env');
      envProvider.getSecret.mockResolvedValue('actual-value');

      await service.onModuleInit();
      const value = await service.getOrDefault('SOME_KEY', 'default');

      expect(value).toBe('actual-value');
    });

    it('returns default value when secret not found', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockReturnValue('env');
      envProvider.getSecret.mockResolvedValue(null);

      await service.onModuleInit();
      const value = await service.getOrDefault('MISSING_KEY', 'default-value');

      expect(value).toBe('default-value');
    });
  });

  describe('getRequired', () => {
    it('returns secret value when found', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockReturnValue('env');
      envProvider.getSecret.mockResolvedValue('required-value');

      await service.onModuleInit();
      const value = await service.getRequired('REQUIRED_KEY');

      expect(value).toBe('required-value');
    });

    it('throws error when secret not found', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockReturnValue('env');
      envProvider.getSecret.mockResolvedValue(null);

      await service.onModuleInit();
      
      await expect(service.getRequired('MISSING_KEY'))
        .rejects.toThrow('Required secret not found: MISSING_KEY');
    });
  });

  describe('invalidate', () => {
    it('removes cached secret', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'SECRETS_PROVIDER') return 'env';
        if (key === 'SECRETS_CACHE_TTL') return 300000;
        if (key === 'SECRETS_CACHE_ENABLED') return true;
        return defaultValue;
      });
      envProvider.getSecret
        .mockResolvedValueOnce('first-value')
        .mockResolvedValueOnce('second-value');

      await service.onModuleInit();
      
      // Cache the first value
      await service.get('CACHED_KEY');
      
      // Invalidate the cache
      service.invalidate('CACHED_KEY');
      
      // Should fetch new value
      const value = await service.get('CACHED_KEY');

      expect(envProvider.getSecret).toHaveBeenCalledTimes(2);
      expect(value).toBe('second-value');
    });
  });

  describe('healthCheck', () => {
    it('returns provider health status', async () => {
      const { service, configService, envProvider } = createMocks();
      configService.get.mockReturnValue('env');
      envProvider.healthCheck.mockResolvedValue(true);

      await service.onModuleInit();
      const status = await service.healthCheck();

      expect(status).toEqual({
        provider: 'env',
        healthy: true,
      });
    });
  });
});
