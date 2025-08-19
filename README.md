# DriveHR Netlify Sync

Automated job synchronization service that fetches job postings from DriveHR and
syncs them to WordPress via Netlify Functions.

## Recent Updates

- Migrated to modern Netlify Functions format with ES modules
- Removed vestigial WP_AUTH_TOKEN requirement in favor of webhook-based
  authentication
- Fixed deployment configuration for proper function discovery

Last updated: August 19, 2025

Environment variables now configured in Netlify - triggering fresh deployment.
