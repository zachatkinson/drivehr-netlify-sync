import { StringUtils, DateUtils } from '../../lib/utils.js';
import type { RawJobData, NormalizedJob, JobSource } from '../../types/job.js';

export class JobNormalizer {
  /**
   * Normalize raw job data into consistent format
   *
   * Processes an array of raw job data from various sources and normalizes
   * them into a consistent structure. Filters out invalid jobs (e.g., those
   * without titles) and adds metadata like source and processing timestamp.
   *
   * @param rawJobs - Array of raw job data from fetching strategies
   * @param source - Source identifier for tracking job origin
   * @returns Promise resolving to array of normalized job objects
   * @since 1.0.0
   * @see {@link normalizeJob} for individual job normalization
   */
  public async normalizeJobs(rawJobs: RawJobData[], source: JobSource): Promise<NormalizedJob[]> {
    const processedAt = DateUtils.getCurrentIsoTimestamp();

    return rawJobs
      .map(rawJob => this.normalizeJob(rawJob, source, processedAt))
      .filter((job): job is NormalizedJob => job !== null);
  }

  /**
   * Normalize individual job data into consistent format
   *
   * Extracts and normalizes job fields from raw data, handling various
   * field name variations across different data sources. Generates fallback
   * values for missing data and ensures consistent data types.
   *
   * @param rawJob - Raw job data from any source
   * @param source - Source identifier for tracking job origin
   * @param processedAt - Timestamp when processing occurred
   * @returns Normalized job object or null if job is invalid (no title)
   * @since 1.0.0
   * @see {@link NormalizedJob} for the normalized job structure
   */
  private normalizeJob(
    rawJob: RawJobData,
    source: JobSource,
    processedAt: string
  ): NormalizedJob | null {
    const title = this.extractJobTitle(rawJob);
    if (!title) {
      return null; // Skip jobs without titles
    }

    return {
      id: this.extractJobId(rawJob, title),
      title,
      department: this.extractJobDepartment(rawJob),
      location: this.extractJobLocation(rawJob),
      type: this.extractJobType(rawJob),
      description: this.extractJobDescription(rawJob),
      postedDate: this.extractJobPostedDate(rawJob),
      applyUrl: this.extractJobApplyUrl(rawJob),
      source,
      rawData: rawJob,
      processedAt,
    };
  }

  /**
   * Extract job title from raw job data
   *
   * Handles various field name variations for job titles across different
   * data sources and normalizes whitespace.
   *
   * @param rawJob - Raw job data from any source
   * @returns Normalized job title string
   * @since 1.0.0
   */
  private extractJobTitle(rawJob: RawJobData): string {
    const title = rawJob.title ?? rawJob.position_title ?? rawJob.name ?? '';
    return title.trim();
  }

  /**
   * Extract or generate job ID from raw job data
   *
   * Uses existing job ID if available, otherwise generates a unique ID
   * based on the job title.
   *
   * @param rawJob - Raw job data from any source
   * @param title - Normalized job title for fallback ID generation
   * @returns Unique job identifier
   * @since 1.0.0
   */
  private extractJobId(rawJob: RawJobData, title: string): string {
    return rawJob.id ?? rawJob.job_id ?? this.generateJobId(title);
  }

  private extractJobDepartment(rawJob: RawJobData): string {
    const department = rawJob.department ?? rawJob.category ?? rawJob.division ?? '';
    return department.trim();
  }

  private extractJobLocation(rawJob: RawJobData): string {
    const location = rawJob.location ?? rawJob.city ?? rawJob.office ?? '';
    return location.trim();
  }

  private extractJobType(rawJob: RawJobData): string {
    const type = rawJob.type ?? rawJob.employment_type ?? rawJob.schedule ?? 'Full-time';
    return type.trim();
  }

  private extractJobDescription(rawJob: RawJobData): string {
    const description = rawJob.description ?? rawJob.summary ?? rawJob.overview ?? '';
    return description.trim();
  }

  /**
   * Extract and normalize job posted date
   *
   * Handles various date field names and formats, converting to ISO string.
   * Uses current timestamp as fallback if no date is provided.
   *
   * @param rawJob - Raw job data from any source
   * @returns ISO formatted date string
   * @since 1.0.0
   */
  private extractJobPostedDate(rawJob: RawJobData): string {
    const dateString = rawJob.posted_date ?? rawJob.created_at ?? rawJob.date_posted;
    return dateString ? DateUtils.toIsoString(dateString) : DateUtils.getCurrentIsoTimestamp();
  }

  private extractJobApplyUrl(rawJob: RawJobData): string {
    return rawJob.apply_url ?? rawJob.application_url ?? rawJob.url ?? '';
  }

  /**
   * Generate unique job ID from title
   *
   * Creates a normalized, URL-safe identifier from the job title.
   *
   * @param title - Job title to generate ID from
   * @returns Normalized job identifier
   * @since 1.0.0
   */
  private generateJobId(title: string): string {
    return StringUtils.generateIdFromTitle(title);
  }
}
