/**
 * Common type definitions for the DriveHR Netlify Sync project
 */

// Environment configuration interface
export interface EnvironmentConfig {
  readonly driveHrisCompanyId: string;
  readonly wpApiUrl: string;
  readonly wpAuthToken: string;
  readonly webhookSecret: string;
  readonly environment: 'development' | 'staging' | 'production';
  readonly logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// API Response wrapper
export interface ApiResponse<T = unknown> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly timestamp: Date;
}

// Basic job data structure (will be expanded later)
export interface JobPosting {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly department?: string;
  readonly location?: string;
  readonly salaryRange?: string;
  readonly postedDate: Date;
  readonly expiryDate?: Date;
}

// Logging interface - follows industry standard pattern
export interface Logger {
  error: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  debug: (message: string, ...args: unknown[]) => void;
}
