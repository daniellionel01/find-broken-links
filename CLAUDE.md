# CLAUDE.md - find-broken-links Codebase Guide

## Commands

- Run application: `bun run index.ts <directory-path>`
- Run tests: `bun test`
- Run specific test: `bun test tests/link-regex.test.ts` or `bun test 'should handle GitHub URLs'`
- Debug utility: `bun run debug.ts`
- Typecheck: `bun tsc --noEmit`

## Code Style Guidelines

- **Formatting**: Use 2-space indentation
- **Types**: Define TypeScript interfaces/types (see `LinkCheckResult` type)
- **Constants**: Use UPPER_CASE for constants (e.g., `FILE_EXTENSIONS`, `CONCURRENCY_LIMIT`)
- **Functions**: Use camelCase for function names
- **Error Handling**: Use try/catch blocks with detailed error messages in catch blocks
- **Async/Await**: Use async/await pattern for asynchronous operations
- **Exports**: Export functions that need testing; prefer named exports
- **RegEx**: Complex URL/link extraction uses multiple specialized regex patterns
- **Tests**: Group tests with `describe()` blocks, write detailed test descriptions