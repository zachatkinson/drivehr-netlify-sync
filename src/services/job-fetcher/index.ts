/**
 * Job Fetcher Module - Barrel Export
 *
 * Enterprise-grade job fetching service that implements the Strategy pattern
 * to handle multiple job data sources and formats. Follows SOLID principles
 * with each strategy responsible for one specific method of data retrieval
 * (API endpoints, JSON files, HTML scraping, embedded data).
 *
 * The service automatically tries different strategies in order of preference,
 * providing robust fallback mechanisms when primary data sources are unavailable.
 * All strategies include comprehensive error handling and data validation.
 *
 * @module job-fetcher
 * @since 1.0.0
 * @see {@link IJobFetchStrategy} for strategy interface
 * @see {@link JobFetchService} for the main orchestration service
 * @see {@link DriveHrUrlBuilder} for URL construction utilities
 */

// Main service export
export { JobFetchService } from './job-fetch-service.js';

// Core components
export { JobNormalizer } from './job-normalizer.js';
export { HtmlJobFetchStrategy } from './html-strategy.js';
export { DefaultFetchTelemetryStrategy } from './telemetry.js';
export { FetchOperationTemplate, DriveHrFetchOperation } from './fetch-operations.js';

// Type definitions
export type {
  IFetchTelemetryStrategy,
  IJobFetchStrategy,
  IHtmlParser,
  FetchOperationContext,
} from './types.js';
