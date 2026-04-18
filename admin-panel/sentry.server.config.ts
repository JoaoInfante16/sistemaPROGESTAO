// Sentry server-side init. Só ativa se SENTRY_DSN setada (prod no Render).
// Dev e staging ficam sem envio — zero overhead, zero quota.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.2,
  });
}
