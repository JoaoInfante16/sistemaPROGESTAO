// Sentry client-side init (Next.js 15+). Só ativa se NEXT_PUBLIC_SENTRY_DSN setada.
// Como é NEXT_PUBLIC_*, o valor vira inline no bundle — checado em build-time.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'production',
    tracesSampleRate: 0.2,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
