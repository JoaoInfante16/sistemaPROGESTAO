import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config) => {
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      "node_modules",
    ];
    return config;
  },
};

// Sentry webpack plugin — só tenta subir sourcemaps/releases se
// SENTRY_AUTH_TOKEN estiver setado (prod no Render). Sem token: build normal,
// apenas o runtime SDK roda (se DSN também estiver setada).
export default withSentryConfig(nextConfig, {
  org: "joao-mw",
  project: "simeops-admin",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
