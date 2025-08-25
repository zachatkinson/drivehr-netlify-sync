# Contributing to DriveHR Netlify Sync

First off, thank you for considering contributing to DriveHR Netlify Sync! It's
people like you that make this tool better for everyone.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Documentation Standards](#documentation-standards)
- [Community](#community)

## Code of Conduct

This project and everyone participating in it is governed by the
[Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to
uphold this code. Please report unacceptable behavior to the project
maintainers.

## Getting Started

### Prerequisites

Before you begin, ensure you have:

- Node.js 20.0.0 or higher
- pnpm 8.0.0 or higher
- Git 2.30.0 or higher
- A GitHub account
- Familiarity with TypeScript and serverless functions

### Setting Up Your Development Environment

1. **Fork the repository**

   ```bash
   # Click "Fork" button on GitHub
   # Clone your fork locally
   git clone https://github.com/your-username/drivehr-netlify-sync.git
   cd drivehr-netlify-sync
   ```

2. **Add upstream remote**

   ```bash
   git remote add upstream https://github.com/zachatkinson/drivehr-netlify-sync.git
   git fetch upstream
   ```

3. **Install dependencies**

   ```bash
   pnpm install
   ```

4. **Create a branch**

   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

5. **Set up environment**
   ```bash
   cp .env.example .env
   # Configure your local environment variables
   ```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

#### How to Submit a Good Bug Report

Create an issue using the bug report template with:

- **Clear title**: Summarize the issue in one line
- **Description**: Detailed explanation of the bug
- **Reproduction steps**: Minimal steps to reproduce
- **Expected behavior**: What should happen
- **Actual behavior**: What actually happens
- **Environment details**: OS, Node version, pnpm version
- **Screenshots**: If applicable
- **Error logs**: Include relevant error messages

Example:

```markdown
### Bug Description

The webhook signature validation fails when payload contains Unicode characters

### Steps to Reproduce

1. Create a job with title "Software Engineer - 日本語"
2. Trigger webhook sync
3. Observe signature validation error

### Expected Behavior

Unicode characters should be properly handled in HMAC signature

### Actual Behavior

Signature validation fails with "Invalid signature" error

### Environment

- Node.js: 20.18.0
- pnpm: 9.0.0
- OS: macOS 14.0
```

### Suggesting Enhancements

#### Before Submitting an Enhancement

- Check if the enhancement has already been suggested
- Consider if it aligns with the project's goals
- Think about backward compatibility

#### How to Submit an Enhancement Suggestion

Create an issue using the feature request template with:

- **Use case**: Why is this enhancement needed?
- **Proposed solution**: How should it work?
- **Alternatives considered**: What other solutions did you consider?
- **Additional context**: Mockups, examples, or references

### Contributing Code

#### First-Time Contributors

Look for issues labeled:

- `good first issue` - Simple issues perfect for beginners
- `help wanted` - Issues where we need community help
- `documentation` - Documentation improvements

#### Code Contributions

1. **Find an issue** to work on or create one
2. **Comment** on the issue to claim it
3. **Follow** our development standards in [CLAUDE.md](CLAUDE.md)
4. **Write tests** for your changes
5. **Update documentation** as needed
6. **Submit a pull request**

## Development Process

### Branch Naming Convention

Use descriptive branch names:

- `feature/add-retry-logic` - New features
- `fix/webhook-signature-validation` - Bug fixes
- `docs/update-deployment-guide` - Documentation
- `refactor/improve-error-handling` - Code refactoring
- `test/add-integration-tests` - Test additions
- `perf/optimize-job-parsing` - Performance improvements

### Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or corrections
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Maintenance tasks

#### Examples

```bash
feat(webhook): add retry logic for failed webhook deliveries

Implements exponential backoff retry strategy for webhook failures.
Adds configurable max retry attempts and delay settings.

Closes #123

---

fix(security): properly validate HMAC signatures with Unicode

Ensures Unicode characters are correctly encoded before HMAC
signature generation to prevent validation failures.

Fixes #456
```

### Code Quality Requirements

Before submitting a PR, ensure:

1. **Format code**

   ```bash
   pnpm run format
   ```

2. **Type checking passes**

   ```bash
   pnpm typecheck
   ```

3. **Linting passes**

   ```bash
   pnpm lint
   ```

4. **Tests pass**

   ```bash
   pnpm test
   ```

5. **Security audit passes**

   ```bash
   pnpm run security
   ```

6. **Coverage maintained**
   ```bash
   pnpm test:coverage
   # Ensure 80%+ coverage
   ```

## Pull Request Process

### Before Submitting

- [ ] Code follows [CLAUDE.md](CLAUDE.md) standards
- [ ] All tests pass locally
- [ ] Documentation updated if needed
- [ ] Commit messages follow conventions
- [ ] Branch is up to date with main
- [ ] No merge conflicts

### Pull Request Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Related Issue

Fixes #(issue number)

## Testing

- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests added/updated
- [ ] All tests passing
```

### Review Process

1. **Automated checks** must pass:
   - CI/CD pipeline
   - Test coverage
   - Security scanning
   - Type checking
   - Linting

2. **Code review** by maintainers:
   - Code quality and standards
   - Architecture and design
   - Security implications
   - Performance impact
   - Documentation completeness

3. **Feedback incorporation**:
   - Address review comments
   - Update PR based on feedback
   - Re-request review when ready

4. **Merge criteria**:
   - All checks passing
   - Approved by at least one maintainer
   - No unresolved conversations
   - Up to date with main branch

## Style Guidelines

### TypeScript Standards

Follow our comprehensive standards in [CLAUDE.md](CLAUDE.md):

- **Strict TypeScript**: No `any` types
- **JSDoc comments**: All public APIs documented
- **SOLID principles**: Clean architecture
- **DRY principle**: No code duplication
- **Security first**: Input validation, sanitization

### File Organization

```typescript
// 1. Imports (grouped and ordered)
import { external } from 'package';
import { internal } from '../lib/module';
import type { Types } from '../types';

// 2. Constants and configurations
const CONFIG = {};

// 3. Types and interfaces
interface ServiceOptions {}

// 4. Main implementation
export class Service {}

// 5. Helper functions
function helper() {}

// 6. Exports
export { helper };
```

## Testing Guidelines

### Test Structure

```typescript
describe('ServiceName', () => {
  // Setup
  beforeEach(() => {});

  describe('when [condition]', () => {
    it('should [expected behavior]', () => {
      // Arrange
      const input = {};

      // Act
      const result = service.method(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Test Coverage Requirements

- **Business logic**: 90%+ coverage
- **Security functions**: 90%+ coverage
- **Integration points**: 80%+ coverage
- **Utilities**: 70%+ coverage

### Test Best Practices

- Write descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Use realistic test data
- Test error cases and edge conditions
- Avoid testing implementation details
- Mock external dependencies appropriately

## Documentation Standards

### Code Documentation

Every public function needs JSDoc:

````typescript
/**
 * Processes webhook payload and delivers to WordPress
 *
 * @param payload - The job synchronization payload
 * @param config - Webhook configuration settings
 * @returns Promise resolving to delivery result
 * @throws {WebhookError} When delivery fails
 * @example
 * ```typescript
 * const result = await deliverWebhook(payload, config);
 * console.log(`Delivered ${result.jobCount} jobs`);
 * ```
 * @since 1.0.0
 */
````

### README Updates

Update README.md when:

- Adding new features
- Changing configuration options
- Modifying API interfaces
- Updating requirements

### API Documentation

Document all:

- Function parameters and returns
- Environment variables
- Configuration options
- Error responses
- Usage examples

## Community

### Getting Help

- **Documentation**: Start with our [README](README.md)
- **Issues**: Search existing
  [GitHub Issues](https://github.com/zachatkinson/drivehr-netlify-sync/issues)
- **Discussions**: Join
  [GitHub Discussions](https://github.com/zachatkinson/drivehr-netlify-sync/discussions)
- **Support**: See [SUPPORT.md](SUPPORT.md) for support channels

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and discussions
- **Pull Requests**: Code contributions and reviews

### Recognition

We value all contributions! Contributors are:

- Listed in our [Contributors](#) section
- Mentioned in release notes
- Given credit in relevant documentation

## License

By contributing, you agree that your contributions will be licensed under the
same [MIT License](LICENSE) that covers this project.

## Questions?

Feel free to open an issue with the `question` label or start a discussion.
We're here to help!

---

Thank you for contributing to DriveHR Netlify Sync! 🎉
