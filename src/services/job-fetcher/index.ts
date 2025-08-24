/**
 * Job Fetcher Module Exports
 *
 * Enterprise-grade job fetching framework implementing comprehensive Strategy pattern
 * architecture for DriveHR job data extraction. This barrel module provides centralized
 * access to all job fetching components, strategies, services, and type definitions
 * required for building robust job data extraction pipelines.
 *
 * The framework implements SOLID principles with each strategy responsible for one
 * specific method of data retrieval (API endpoints, HTML scraping, embedded data).
 * The service automatically tries different strategies in order of preference,
 * providing robust fallback mechanisms when primary data sources are unavailable.
 *
 * Core Architecture Components:
 * - JobFetchService: Main orchestration service with strategy management
 * - Strategy Pattern: Multiple fetch strategies with automatic fallbacks
 * - Template Method: Consistent operation workflow across all strategies
 * - Dependency Injection: Pluggable components for flexibility
 * - Telemetry Integration: Comprehensive monitoring and error reporting
 * - Job Normalization: Data transformation and validation pipeline
 *
 * @example
 * ```typescript
 * import {
 *   JobFetchService,
 *   HtmlJobFetchStrategy,
 *   JobNormalizer,
 *   DefaultFetchTelemetryStrategy
 * } from './job-fetcher/index.js';
 * import { createHttpClient } from '../lib/http-client.js';
 * import { CheerioHtmlParser } from '../html-parser.js';
 *
 * // Initialize components
 * const httpClient = createHttpClient({ timeout: 30000 });
 * const htmlParser = new CheerioHtmlParser();
 * const jobNormalizer = new JobNormalizer();
 * const telemetryStrategy = new DefaultFetchTelemetryStrategy();
 *
 * // Create strategies
 * const htmlStrategy = new HtmlJobFetchStrategy(htmlParser);
 *
 * // Initialize service
 * const jobFetchService = new JobFetchService(
 *   httpClient,
 *   jobNormalizer,
 *   telemetryStrategy,
 *   [htmlStrategy]
 * );
 *
 * // Fetch jobs with automatic strategy fallbacks
 * const config = { companyId: 'acme', careersUrl: 'https://acme.com/careers' };
 * const result = await jobFetchService.fetchJobs(config, 'webhook');
 *
 * if (result.success) {
 *   console.log(`Fetched ${result.jobs.length} jobs using ${result.method}`);
 * }
 * ```
 *
 * @module job-fetcher
 * @since 1.0.0
 * @see {@link IJobFetchStrategy} for strategy interface contract
 * @see {@link JobFetchService} for the main orchestration service
 * @see {@link FetchOperationTemplate} for operation template pattern
 * @see {@link JobNormalizer} for data normalization pipeline
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
