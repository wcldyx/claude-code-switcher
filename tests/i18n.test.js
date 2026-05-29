const { detectLocale, t } = require('../src/utils/i18n');

describe('i18n', () => {
  test('should detect explicit English locale', () => {
    expect(detectLocale({ CC_LANG: 'en-US' })).toBe('en');
  });

  test('should detect explicit Chinese locale', () => {
    expect(detectLocale({ CC_LANG: 'zh-CN' })).toBe('zh');
  });

  test('should translate CLI text', () => {
    expect(t('cli.description', {}, 'en')).toBe('Claude Code environment switcher');
    expect(t('cli.description', {}, 'zh')).toBe('Claude Code环境变量快速切换工具');
  });

  test('should format parameters', () => {
    expect(t('update.available', { latest: '2.0.1', current: '2.0.0' }, 'en'))
      .toContain('2.0.1');
  });
});
