import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { connectDB } from './server/db.js';
import { seedInitialData } from './server/seed/seedData.js';
import { createApp } from './server/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  console.log('--- VELoop Rewards Backend Starting ---');
  console.log('MONGODB_URL / MONGODB_URI exists:',
    Boolean(process.env.MONGODB_URL || process.env.MONGODB_URI));

  try {
    const mongoUri = await connectDB();
    console.log(`MongoDB Ready: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`);
  } catch (err: any) {
    console.log('Failed to initialize MongoDB:', err?.message || err);
    process.exit(1);
  }

  try {
    await seedInitialData();
  } catch (err: any) {
    console.log('Error seeding initial data:', err?.message || err);
  }

  const app = createApp();

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('Vite middleware mounted in development mode');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('Static SPA distribution mounted in production mode');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VELoop Rewards Server listening on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.log('Fatal bootstrap error:', err?.message || err);
});
