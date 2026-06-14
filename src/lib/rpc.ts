import { hc } from 'hono/client';
import type { AppRouter } from '../../functions/api/[[route]]';

// Use a relative URL for local development and absolute for production if needed
export const rpc = hc<AppRouter>('/');
