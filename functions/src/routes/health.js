export function registerHealthRoutes(app) {
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'sms-faas',
      timestamp: new Date().toISOString()
    });
  });
}
