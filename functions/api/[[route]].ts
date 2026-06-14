import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import { authRouter } from './auth';
import { settingsRouter } from './settings';
import { libraryRouter } from './library';
import { anilistRouter } from './anilist';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// Mount sub-routers
const routes = app
  .route('/auth', authRouter)
  .route('/settings', settingsRouter)
  .route('/library', libraryRouter)
  .route('/anilist', anilistRouter);

export type AppRouter = typeof routes;

export const onRequest = handle(app);
