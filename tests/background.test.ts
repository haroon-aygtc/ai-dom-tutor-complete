describe('BackgroundService', () => {
  test('loads default config', async () => {
    global.chrome = {
      storage: {
        sync: {
          get: jest.fn().mockResolvedValue({})
        }
      }
    } as any;
    const service = new BackgroundService();
    await (service as any).loadConfig();
    expect((service as any).config.activeProvider).toBe('openai');
  });
});
