# [1.1.0](https://github.com/zachatkinson/drivehr-netlify-sync/compare/v1.0.1...v1.1.0) (2025-08-25)

### Features

- **tests:** boost Playwright scraper test coverage from 15.11% to 44.06%
  ([755c31c](https://github.com/zachatkinson/drivehr-netlify-sync/commit/755c31cb00a308759d66916a1d7c6c6b7bdd831e))

## [1.0.1](https://github.com/zachatkinson/drivehr-netlify-sync/compare/v1.0.0...v1.0.1) (2025-08-25)

### Bug Fixes

- **docs:** update Netlify badge with correct site ID
  ([d405efe](https://github.com/zachatkinson/drivehr-netlify-sync/commit/d405efec5a5219d3c16557a876a81f6e874c1e35))

# 1.0.0 (2025-08-25)

### Bug Fixes

- Add clearEnvironment() calls to config tests expecting missing env vars
  ([90cb369](https://github.com/zachatkinson/drivehr-netlify-sync/commit/90cb3696eed87f3c35a7a0b721a32e41e3791d45))
- add Codecov token to enable coverage reporting
  ([c8953ef](https://github.com/zachatkinson/drivehr-netlify-sync/commit/c8953efa851d57805daffbf4a763b6dcc0984055))
- Add error handling for missing coverage files in CI aggregation
  ([2d3ba54](https://github.com/zachatkinson/drivehr-netlify-sync/commit/2d3ba540545f993bbaa3024455307ed6cd2e4722))
- add missing @vitest/coverage-v8 dependency
  ([c4cc64a](https://github.com/zachatkinson/drivehr-netlify-sync/commit/c4cc64a082b8f416f4c4ed85282dfb192763fa4e))
- Add missing DRIVEHR_COMPANY_ID to CI environment
  ([6a90b24](https://github.com/zachatkinson/drivehr-netlify-sync/commit/6a90b2499a8a89c2698df57b2a3127d17ac843ad))
- Add missing WordPress payload test to CI matrix
  ([41f64e8](https://github.com/zachatkinson/drivehr-netlify-sync/commit/41f64e8fae60c215b4bf9df275777738d90fb2db))
- Add mock environment variables for WordPress payload tests in CI
  ([d7b3682](https://github.com/zachatkinson/drivehr-netlify-sync/commit/d7b3682e1e99163b52255f7c47ed94384d9d053b))
- Add root_dir parameter to codecov-action for proper path resolution
  ([b219cc5](https://github.com/zachatkinson/drivehr-netlify-sync/commit/b219cc5a760368015a309026b8d32cc599c011a3))
- bypass Netlify UI build settings with skip-functions-cache
  ([249ffe3](https://github.com/zachatkinson/drivehr-netlify-sync/commit/249ffe31083ed7dcf94747ef79f10e21e09b6aee))
- **ci:** Fix JSON formatting and consolidate to single CI pipeline
  ([e54becf](https://github.com/zachatkinson/drivehr-netlify-sync/commit/e54becfea67e02b8afdcfdbd5ef306ee5b18cb7e))
- **ci:** Resolve GitHub Actions JSON formatting with single-line approach
  ([fda6d95](https://github.com/zachatkinson/drivehr-netlify-sync/commit/fda6d95265a1b6c65f9c5390dd73bbc215b89d3d))
- clean build output to prevent Netlify deployment conflicts
  ([defb6eb](https://github.com/zachatkinson/drivehr-netlify-sync/commit/defb6eb57c521fadb338b31358eb6093eefd743e))
- Clear all CI environment variables in WordPress payload error tests
  ([06f1b67](https://github.com/zachatkinson/drivehr-netlify-sync/commit/06f1b67e7a982f824b1639501a72c7589b4d20ff))
- Config tests now handle CI environment variable DRIVEHR_COMPANY_ID
  ([4d2b601](https://github.com/zachatkinson/drivehr-netlify-sync/commit/4d2b601e68e0e64ba10070d31f0b4eff95ddb0e3))
- correct build output path for Netlify functions
  ([7ba7780](https://github.com/zachatkinson/drivehr-netlify-sync/commit/7ba7780ac9ae58535f4dbfe208ee1428821ad027))
- correct CI health check to use deployment URL from job output
  ([717c19f](https://github.com/zachatkinson/drivehr-netlify-sync/commit/717c19ffc0d92afd71376ba4eff816eee6308c82))
- correct formatting in job-fetch-utils test comments
  ([9ecae51](https://github.com/zachatkinson/drivehr-netlify-sync/commit/9ecae516155e10cb5e14f34c0cfcbc32dc759d6e))
- correct functions directory path in netlify.toml
  ([86879c1](https://github.com/zachatkinson/drivehr-netlify-sync/commit/86879c162c77825e72b419ad7671ee15b28a9d9e))
- correct netlify.toml edge_functions configuration syntax
  ([e8c4f3d](https://github.com/zachatkinson/drivehr-netlify-sync/commit/e8c4f3d1a59f73f96f2d15648848289be579d75b))
- correct pnpm setup order in CI/CD pipeline
  ([0eb7076](https://github.com/zachatkinson/drivehr-netlify-sync/commit/0eb70766897986e99baa9e6383c1a89e23d52854))
- correct pnpm setup order in test matrix jobs
  ([5bc9c34](https://github.com/zachatkinson/drivehr-netlify-sync/commit/5bc9c34d21649c2653e188e7479ee844de764ad2))
- Correct WordPress webhook endpoint URL format and add CLAUDE.md standards
  ([f87072a](https://github.com/zachatkinson/drivehr-netlify-sync/commit/f87072a87ab82edd51ee4d2a409930f148bff608))
- Disable Codecov file search to upload only merged coverage file
  ([0ba154d](https://github.com/zachatkinson/drivehr-netlify-sync/commit/0ba154d4aa8a9244ea5e0ee2842cc5db969cd76d))
- disable Netlify build processing for pre-built functions
  ([05549e6](https://github.com/zachatkinson/drivehr-netlify-sync/commit/05549e6008805e0a112b0e7d85fece21c0957b46))
- Exclude Netlify build artifacts from coverage calculation
  ([3160d5a](https://github.com/zachatkinson/drivehr-netlify-sync/commit/3160d5ad482d19aca84748dd442800b43f885100))
- exclude TypeScript declaration files from Netlify functions directory
  ([fde4f3b](https://github.com/zachatkinson/drivehr-netlify-sync/commit/fde4f3b2cd9aaeb56567494b48bbcfd3857c4f85))
- Explicit environment variable inheritance for child processes in CI
  ([806a7a1](https://github.com/zachatkinson/drivehr-netlify-sync/commit/806a7a1df57af4fa7bdc9529a5d0691955764019))
- Explicitly clear CI environment variables in WordPress payload test
  ([b886ea2](https://github.com/zachatkinson/drivehr-netlify-sync/commit/b886ea2e3871f3a43539bdc7f7be6a3b2953731e))
- Improve environment variable validation to handle empty strings
  ([31b8f37](https://github.com/zachatkinson/drivehr-netlify-sync/commit/31b8f37cb3cc3524ac699682d3437d403956fd63))
- Improve scrape-and-sync script test coverage by testing actual function
  ([1ea1618](https://github.com/zachatkinson/drivehr-netlify-sync/commit/1ea1618be53ed81081a917f9c479e43080636c9a))
- include services directory in build for Netlify function deployment
  ([5eadc6e](https://github.com/zachatkinson/drivehr-netlify-sync/commit/5eadc6e39617f1d16e842f75daebf9a146014a5c))
- make CI scripts graceful when no source files exist
  ([5fb55a5](https://github.com/zachatkinson/drivehr-netlify-sync/commit/5fb55a53c0d2f33d891280a6a7f4e250f78a7e1f))
- modernize GitHub Actions to eliminate deprecated set-output warnings
  ([1f63bf8](https://github.com/zachatkinson/drivehr-netlify-sync/commit/1f63bf8d7f3d916a171b9bc51c4d1b3bd68ca788))
- Optimize build configuration for Netlify deployment
  ([951a453](https://github.com/zachatkinson/drivehr-netlify-sync/commit/951a453984dbb8fbba12673a534fbd086662ae13))
- Properly delete process.env variables in config tests
  ([55d5fa3](https://github.com/zachatkinson/drivehr-netlify-sync/commit/55d5fa3a5b6ee1165e3d71dca255f1bb05f1dd2d))
- Remove non-existent test directories from CI matrix
  ([cf924f3](https://github.com/zachatkinson/drivehr-netlify-sync/commit/cf924f3f8c762be2b08e22b4cee277540578288a))
- remove pnpm version from CI config
  ([abb6d08](https://github.com/zachatkinson/drivehr-netlify-sync/commit/abb6d086425784dc96a10a11a393ed8dc3059262))
- remove unnecessary git add from lint-staged config
  ([179836d](https://github.com/zachatkinson/drivehr-netlify-sync/commit/179836d840abca0f555591e04c11f262652db54b))
- remove vestigial WP_AUTH_TOKEN requirement from environment config
  ([f483650](https://github.com/zachatkinson/drivehr-netlify-sync/commit/f483650c57fef8974401914fc9428fc2672f385c))
- remove vestigial WP_AUTH_TOKEN test case
  ([37464d2](https://github.com/zachatkinson/drivehr-netlify-sync/commit/37464d228d7b4ec6cce77382ded7f66ad3fcb760))
- Replace complex telemetry test mocking with simplified API validation
  ([c694036](https://github.com/zachatkinson/drivehr-netlify-sync/commit/c69403646045c8f7813ddc8f6059d91a5ea9c7c3))
- Replace complex telemetry-init test mocking with simplified API validation
  ([cabb04c](https://github.com/zachatkinson/drivehr-netlify-sync/commit/cabb04c599e276aab5444a7730e1767a2c5505a7))
- Resolve CI linting failures by correcting eslint-disable comment positioning
  ([8c9e0e3](https://github.com/zachatkinson/drivehr-netlify-sync/commit/8c9e0e3fd600850c9a7fd7d8387c3f651517539b))
- Resolve CI test discovery issue by using directory path instead of glob
  pattern
  ([b33e992](https://github.com/zachatkinson/drivehr-netlify-sync/commit/b33e9927894cc0e463869e3c0dbb3d5c55fb72b7))
- Resolve integration test failures and improve mock Response implementation
  ([0b490ac](https://github.com/zachatkinson/drivehr-netlify-sync/commit/0b490ac961c6c50222ffcb3c8774c157a7e33d8b))
- resolve module import paths for Netlify function deployment
  ([8ff26cb](https://github.com/zachatkinson/drivehr-netlify-sync/commit/8ff26cb0ab021b64864892af509295a927be96bc))
- Resolve Netlify deployment issues and correct webhook documentation
  ([9a3f961](https://github.com/zachatkinson/drivehr-netlify-sync/commit/9a3f96178e2a27baa5642f6653d7cb5e31a22e74))
- Resolve test timeout issues and update environment configuration
  ([7db730d](https://github.com/zachatkinson/drivehr-netlify-sync/commit/7db730d7be2cdf0d18415ec32fef55fc81b13acd))
- Resolve TypeScript and ESLint issues in WordPress payload tests
  ([676e93f](https://github.com/zachatkinson/drivehr-netlify-sync/commit/676e93f12d99e0265184b3358e1c27c9c7751db3))
- Resolve TypeScript index signature errors in CI environment
  ([2deff57](https://github.com/zachatkinson/drivehr-netlify-sync/commit/2deff57820d3a390f262bb00fd01e13791996a09))
- simplify netlify.toml configuration for correct functions path
  ([610a8e3](https://github.com/zachatkinson/drivehr-netlify-sync/commit/610a8e34bf7e13c6c096824151119f854f17074b))
- skip redundant Netlify build process in favor of CI pre-built files
  ([ad2efb8](https://github.com/zachatkinson/drivehr-netlify-sync/commit/ad2efb854467bffe8e87bed3bcaed1e22a17d84e))
- specify functions directory explicitly in Netlify CLI
  ([cf31a49](https://github.com/zachatkinson/drivehr-netlify-sync/commit/cf31a491a8be72002c05290c5d2e590bcc8430d1))
- Standardize CI configuration with consistent Node 20 and pnpm usage
  ([2b84546](https://github.com/zachatkinson/drivehr-netlify-sync/commit/2b84546ee932b741d8f8216abfeadbf34c65ecb4))
- Standardize WordPress webhook endpoint URL format across entire codebase
  ([eb8cbaa](https://github.com/zachatkinson/drivehr-netlify-sync/commit/eb8cbaa43b6b5373ad33f246c4103514de1e6844))
- **tests:** Complete test/services CLAUDE.md audit with implementation
  alignment
  ([5a4f179](https://github.com/zachatkinson/drivehr-netlify-sync/commit/5a4f1796eee8d8cea26eecb26624925163b3914f))
- update .env.example to use clear placeholder values to avoid Netlify secret
  scanning false positives
  ([0ac8a6f](https://github.com/zachatkinson/drivehr-netlify-sync/commit/0ac8a6f22148892e26548b0285e089af691707a4))
- update CI build verification to check netlify.toml in root directory
  ([cf64040](https://github.com/zachatkinson/drivehr-netlify-sync/commit/cf6404052588ef0901a955273a925b0fe9c43d28))
- update CI build verification to expect .mjs files from modern TypeScript
  compilation
  ([d26e9a3](https://github.com/zachatkinson/drivehr-netlify-sync/commit/d26e9a3b7236936016fda27ff6d9ab3ee87a28b7))
- Update CI configuration to discover refactored job fetcher test files
  ([d580d70](https://github.com/zachatkinson/drivehr-netlify-sync/commit/d580d7036cccac0622189d3b64bbc62ba6b992e9))
- update CI to use pnpm v10 and allow lockfile updates
  ([9e01e0a](https://github.com/zachatkinson/drivehr-netlify-sync/commit/9e01e0af0642338af0099f1db127777761c3ef74))
- Update codecov-action parameter from 'file' to 'files' for v5.5.0
  compatibility
  ([f637d1a](https://github.com/zachatkinson/drivehr-netlify-sync/commit/f637d1ac27671adffca6d03fafbe751d06194ca4))
- update husky pre-commit hook to modern format
  ([4cfc1e1](https://github.com/zachatkinson/drivehr-netlify-sync/commit/4cfc1e171bbc9f3f175abe64a9f14b229dbd96ff))
- update test assertion to use correct environment variable name
  ([f8f909c](https://github.com/zachatkinson/drivehr-netlify-sync/commit/f8f909c8600587d15b203ed13c6689891dc1596d))
- Update test regex to match new WordPress webhook URL format
  ([0308fa6](https://github.com/zachatkinson/drivehr-netlify-sync/commit/0308fa6c34a629cdc33c793347a6cdf4b6f5cba5))
- Upgrade to codecov-action@v5 to resolve path mismatch issues
  ([34adf53](https://github.com/zachatkinson/drivehr-netlify-sync/commit/34adf5366e3bf7797ce27eb329db5a12f13653e7))
- Use bracket notation for process.env property access
  ([eafa31c](https://github.com/zachatkinson/drivehr-netlify-sync/commit/eafa31cb8b526e8fb68c0456d2a35719fa258909))
- Use hyphens instead of spaces in CI artifact names for URL-safe naming
  ([46467e3](https://github.com/zachatkinson/drivehr-netlify-sync/commit/46467e3f573f14dbdb3fed00aec9868861fb3f39))
- use production URL instead of deploy preview URL for health checks
  ([0f8a430](https://github.com/zachatkinson/drivehr-netlify-sync/commit/0f8a430105ed697b1c9567b4781179e9874db922))
- WordPress payload tests environment inheritance
  ([fbba977](https://github.com/zachatkinson/drivehr-netlify-sync/commit/fbba977e5625ca30f58a36449e0e04a04dd6a5e4))

### Features

- add basic TypeScript types and test files to enable full CI
  ([cece9e2](https://github.com/zachatkinson/drivehr-netlify-sync/commit/cece9e28f2289c91d568e6f55c8bd6485f3bd996))
- add Codecov Test Analytics with comprehensive test intelligence
  ([ad2e4f5](https://github.com/zachatkinson/drivehr-netlify-sync/commit/ad2e4f5f3f7715a4703803da4fce602adf485e1d))
- Add comprehensive deployment documentation and verification tools
  ([3e9a5e4](https://github.com/zachatkinson/drivehr-netlify-sync/commit/3e9a5e47a03ef58eadff428996d63819bacd83ea))
- Add comprehensive easy-win test cases for playwright-scraper.ts coverage
  improvement
  ([5411a12](https://github.com/zachatkinson/drivehr-netlify-sync/commit/5411a12a01c57ab7e008f143caa34367699eb405))
- Add comprehensive easy-win test coverage for telemetry modules
  ([c485bfd](https://github.com/zachatkinson/drivehr-netlify-sync/commit/c485bfddac0b99374589f5776b1f80dd9c211b88))
- Add comprehensive enterprise-grade test coverage for telemetry modules
  ([5aa82c6](https://github.com/zachatkinson/drivehr-netlify-sync/commit/5aa82c635be20d3b684d3fcd918e3bd9e8273c45))
- Add comprehensive integration and unit tests to significantly improve test
  coverage
  ([572ba00](https://github.com/zachatkinson/drivehr-netlify-sync/commit/572ba00e930fb0cd3bcb47f339baaf2d2190ae0c))
- Add comprehensive job data inspection and analysis toolkit
  ([58716f4](https://github.com/zachatkinson/drivehr-netlify-sync/commit/58716f4e93a835a496355d76003b2f437f8166b4))
- add comprehensive job fetch utils test suite using DRY principles
  ([e7c0ad7](https://github.com/zachatkinson/drivehr-netlify-sync/commit/e7c0ad72723b907fc1a36df7849587f8247dc684))
- Add comprehensive JSDoc to scripts directory
  ([b0067d2](https://github.com/zachatkinson/drivehr-netlify-sync/commit/b0067d2b2db3916914b2333a81b62accbfb635dd))
- Add comprehensive WordPress payload testing tool
  ([3c65861](https://github.com/zachatkinson/drivehr-netlify-sync/commit/3c6586138e050f45371b4b39493ace4197e2561c))
- Add coverage artifacts and aggregation to CI pipeline
  ([829ff70](https://github.com/zachatkinson/drivehr-netlify-sync/commit/829ff707a562f88ad2d7948184e32fcc612e102a))
- Add telemetry code path coverage test to boost WordPress client coverage
  ([395cbe8](https://github.com/zachatkinson/drivehr-netlify-sync/commit/395cbe8335f81cbf02d641d89e343210bc740359))
- **ci:** Implement enterprise-grade CI with smart test selection and enhanced
  security
  ([d12b538](https://github.com/zachatkinson/drivehr-netlify-sync/commit/d12b53800f67da7cbb7077f1ed8c7054394bcdc0))
- Complete comprehensive CLAUDE.md compliance audit with zero technical debt
  ([f9a6224](https://github.com/zachatkinson/drivehr-netlify-sync/commit/f9a62249aae041feef92058856a4c0cd5a3e6ec3))
- Complete comprehensive code cleanup and add deployment monitoring
  ([619d398](https://github.com/zachatkinson/drivehr-netlify-sync/commit/619d398c93d9cec66ff124aa912c3677e111380a))
- Complete comprehensive file audit with enterprise JSDoc standards
  ([026fbf9](https://github.com/zachatkinson/drivehr-netlify-sync/commit/026fbf909d2cacf6dc085508fb1813553c776c74))
- Complete comprehensive JSDoc audit for all lib files
  ([7df7a75](https://github.com/zachatkinson/drivehr-netlify-sync/commit/7df7a7519368a2effb47a59daf5e4efcf8005aaa))
- complete comprehensive Netlify function test suite with DRY principles
  ([e727ddb](https://github.com/zachatkinson/drivehr-netlify-sync/commit/e727ddba6684b138a056cde9c7cbbdfa12840216))
- Complete config.ts audit and fix complexity warning
  ([1a1b640](https://github.com/zachatkinson/drivehr-netlify-sync/commit/1a1b640a9ecad9b38153ccf0c045c6f506735103))
- Complete enterprise enhancement suite with performance monitoring and
  documentation
  ([e928b3f](https://github.com/zachatkinson/drivehr-netlify-sync/commit/e928b3f8a3dc1b001603aed8e0c1d4eb261bb96e))
- Complete enterprise-grade enhancements and WordPress REST API cleanup
  ([37047be](https://github.com/zachatkinson/drivehr-netlify-sync/commit/37047be108d25c18f0e8dcb95ffeafa0fa6a26a1))
- **compliance:** Complete comprehensive eslint-disable CLAUDE.md compliance
  audit
  ([93cb81d](https://github.com/zachatkinson/drivehr-netlify-sync/commit/93cb81dc971bd16df4a790f80d331eca0bf86f32))
- enhance CI/CD with enterprise-grade security and performance features
  ([20d7a05](https://github.com/zachatkinson/drivehr-netlify-sync/commit/20d7a0526483d0ece41c40c3bb4afe00a156763c))
- Enhance playwright-scraper test coverage with strategic unit tests and
  comprehensive JSDoc
  ([8e71fc1](https://github.com/zachatkinson/drivehr-netlify-sync/commit/8e71fc1c54790638d70e31dbee9a0e6d53a2e338))
- Enhance scrape-and-sync test coverage to 84.41% with comprehensive edge case
  testing
  ([3942adf](https://github.com/zachatkinson/drivehr-netlify-sync/commit/3942adf657923ae151a7cdde3abdd1d8cc7027b7))
- Fix CI coverage aggregation to properly merge LCOV data from all test suites
  ([9119c68](https://github.com/zachatkinson/drivehr-netlify-sync/commit/9119c6847bf7864761e6d6510cc9dbeb01eddd06))
- Fix test integration issues and improve code quality
  ([61e81f6](https://github.com/zachatkinson/drivehr-netlify-sync/commit/61e81f6d86329da2481be8e67a2888f0b69ed92a))
- Implement enterprise Strategy and Template Method patterns to resolve
  complexity warnings
  ([2c0a0d4](https://github.com/zachatkinson/drivehr-netlify-sync/commit/2c0a0d4140ede24382e5ee710d56ca1f1e74e46a))
- implement enterprise-grade semantic versioning and automated releases
  ([7fa577c](https://github.com/zachatkinson/drivehr-netlify-sync/commit/7fa577c91a98ba10b3d7c1442871efed6e44bcfe))
- implement hybrid CI/CD approach with GitHub Actions and Netlify
  ([6e082b5](https://github.com/zachatkinson/drivehr-netlify-sync/commit/6e082b5cf641f27a5cfa715342cb33e2e90ae7d9))
- implement official Netlify CLI deployment method per documentation
  ([4d7e4f1](https://github.com/zachatkinson/drivehr-netlify-sync/commit/4d7e4f14344ab2dc8fef1ec5541be5d6fca9d9e0))
- implement secure Netlify function with environment utilities
  ([445cec8](https://github.com/zachatkinson/drivehr-netlify-sync/commit/445cec8247a0d5e4c648b039bd43f407fcd58748))
- initial project setup with enterprise-grade configuration
  ([1211a43](https://github.com/zachatkinson/drivehr-netlify-sync/commit/1211a4341542860e83eb77aeb3352a5ef6b5af97))
- migrate to modern Netlify Functions API with web standard Request/Response
  ([033d0c9](https://github.com/zachatkinson/drivehr-netlify-sync/commit/033d0c9f41cba061f77d0eb11c1414c56f49271d))
- Modernize architecture with GitHub Actions scraping and comprehensive code
  cleanup
  ([3635d8b](https://github.com/zachatkinson/drivehr-netlify-sync/commit/3635d8be2e72b19795fec99e134c1ff103691dfe))
- Replace individual Codecov uploads with single aggregated coverage upload
  ([cf8e62f](https://github.com/zachatkinson/drivehr-netlify-sync/commit/cf8e62f5fdb7f7f6f5bbf4fefefbcc2f02360728))
- Switch back to individual coverage uploads per matrix job
  ([1251c4e](https://github.com/zachatkinson/drivehr-netlify-sync/commit/1251c4e8c08656f742250f934cc0d60db64a96a6))
- Upgrade all Codecov actions to latest versions
  ([56672cc](https://github.com/zachatkinson/drivehr-netlify-sync/commit/56672ccb9a6ab82372caa01a3144cdc0df0269a9))

### Reverts

- return to proven netlify/actions/cli@master deployment method
  ([ad38eee](https://github.com/zachatkinson/drivehr-netlify-sync/commit/ad38eee6a6ba9063da343c564124d06f7df4bf31))

### BREAKING CHANGES

- in codecov-action@v5.5.0 requires 'files' parameter instead of 'file'
