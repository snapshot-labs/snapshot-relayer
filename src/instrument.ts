import 'dotenv/config';
import { initLogger } from '@snapshot-labs/snapshot-sentry';

// Since @sentry/node v8, Sentry uses OpenTelemetry-based auto-instrumentation,
// so initLogger() must run before any instrumented module (http, express, ...)
// is imported. This file is loaded as the very first import in index.ts.
initLogger();
