import * as functions from 'firebase-functions';
import admin from 'firebase-admin';
import express from 'express';
import cors from 'cors';

import { registerHealthRoutes } from './src/routes/health.js';
import { registerGraphiqlRoutes } from './src/routes/graphiql.js';
import { registerGraphQLRoutes } from './src/routes/graphql.js';
import mockSmsProvider from './mock-sms-provider.js';

admin.initializeApp();

const app = express();

// CORS (allow env override; default *)
const allowOrigin = process.env.CORS_ALLOW_ORIGIN || '*';
app.use(cors({ origin: allowOrigin === '*' ? true : allowOrigin, credentials: false }));
app.use(express.json({ limit: '1mb' }));

// Routes
registerHealthRoutes(app);
registerGraphiqlRoutes(app);
registerGraphQLRoutes(app);

// Default root ping
app.get('/', (_req, res) => res.status(200).json({ service: 'sms-faas', status: 'ok' }));

// 404
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

// Export Cloud Functions
export const mockSms = functions.https.onRequest(mockSmsProvider);
export const api = functions.https.onRequest(app);
