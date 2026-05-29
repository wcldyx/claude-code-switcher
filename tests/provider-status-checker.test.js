const { ProviderStatusChecker } = require('../src/utils/provider-status-checker');

describe('ProviderStatusChecker', () => {
  describe('checkAllStreaming', () => {
    test('should limit concurrent provider checks', async () => {
      const checker = new ProviderStatusChecker({ env: {}, maxConcurrency: 2 });
      let activeChecks = 0;
      let maxActiveChecks = 0;

      checker.check = jest.fn(async provider => {
        activeChecks += 1;
        maxActiveChecks = Math.max(maxActiveChecks, activeChecks);
        await new Promise(resolve => setTimeout(resolve, 10));
        activeChecks -= 1;
        return { state: 'online', label: provider.name, latency: null };
      });

      const providers = [
        { name: 'p1' },
        { name: 'p2' },
        { name: 'p3' },
        { name: 'p4' },
        { name: 'p5' }
      ];

      const results = await checker.checkAllStreaming(providers);

      expect(Object.keys(results)).toHaveLength(5);
      expect(maxActiveChecks).toBeLessThanOrEqual(2);
    });
  });

  describe('_resolveModel', () => {
    test('should prefer configured haiku for connection checks', () => {
      const checker = new ProviderStatusChecker({ env: {} });

      const model = checker._resolveModel({
        models: {
          opus: 'claude-opus-custom',
          sonnet: 'claude-sonnet-custom',
          haiku: 'claude-haiku-custom'
        }
      });

      expect(model).toBe('claude-haiku-custom');
    });

    test('should fall back from haiku to sonnet and then opus', () => {
      const checker = new ProviderStatusChecker({ env: {} });

      expect(checker._resolveModel({
        models: {
          opus: 'claude-opus-custom',
          sonnet: 'claude-sonnet-custom'
        }
      })).toBe('claude-sonnet-custom');

      expect(checker._resolveModel({
        models: {
          opus: 'claude-opus-custom'
        }
      })).toBe('claude-opus-custom');
    });

    test('should read default model environment variables by price order', () => {
      const checker = new ProviderStatusChecker({
        env: {
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-env',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-env',
          ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-env'
        }
      });

      expect(checker._resolveModel({ models: {} })).toBe('claude-haiku-env');
    });

    test('should fall back through environment variables before default model', () => {
      const checker = new ProviderStatusChecker({
        env: {
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-env',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'claude-sonnet-env'
        }
      });

      expect(checker._resolveModel({ models: {} })).toBe('claude-sonnet-env');
    });

    test('should use built-in haiku model when no configured model exists', () => {
      const checker = new ProviderStatusChecker({ env: {} });

      expect(checker._resolveModel({ models: {} })).toBe(checker.defaultModel);
    });
  });
});
