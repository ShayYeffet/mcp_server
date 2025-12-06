# Contributing to MCP Workspace Server

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/YOUR_USERNAME/mcp-workspace-server/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Your environment (OS, Node.js version, AI client)
   - Relevant logs or error messages

### Suggesting Features

1. Check [Issues](https://github.com/YOUR_USERNAME/mcp-workspace-server/issues) for existing feature requests
2. Create a new issue with:
   - Clear description of the feature
   - Use case and benefits
   - Possible implementation approach

### Pull Requests

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Make your changes**
4. **Add tests** for new functionality
5. **Run tests**: `npm test` (all must pass)
6. **Build the project**: `npm run build`
7. **Commit with clear messages**: `git commit -m "Add feature: description"`
8. **Push to your fork**: `git push origin feature/your-feature-name`
9. **Create a Pull Request**

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/mcp-workspace-server.git
cd mcp-workspace-server

# Install dependencies
npm install

# Run tests in watch mode during development
npm run test:watch

# Build the project
npm run build
```

## Project Structure

```
mcp-workspace-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── config.ts             # Configuration management
│   ├── tools/                # Tool implementations
│   │   ├── listFiles.ts
│   │   ├── readFile.ts
│   │   ├── writeFile.ts
│   │   ├── deleteFile.ts
│   │   ├── createFolder.ts
│   │   ├── applyPatch.ts
│   │   └── runCommand.ts
│   └── utils/                # Utility modules
│       ├── pathUtils.ts      # Path validation & sandboxing
│       ├── fsUtils.ts        # File system operations
│       ├── logging.ts        # Logging utilities
│       └── errors.ts         # Error handling
├── tests/                    # Test files
├── .kiro/specs/              # Design specifications
└── dist/                     # Compiled output (gitignored)
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide explicit type annotations for function parameters and return values
- Avoid `any` types
- Use interfaces for object shapes

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add semicolons
- Use meaningful variable names
- Add JSDoc comments for public APIs

### Testing

- Write unit tests for new functions
- Write property-based tests for universal properties
- Ensure all tests pass before submitting PR
- Aim for high test coverage

### Security

- Always validate user input
- Use path sandboxing for file operations
- Never execute arbitrary commands
- Follow principle of least privilege

## Testing Guidelines

### Unit Tests

Test specific functionality with concrete examples:

```typescript
test('resolveSafePath rejects parent directory traversal', () => {
  expect(() => {
    resolveSafePath('/workspace', '../etc/passwd');
  }).toThrow('outside workspace');
});
```

### Property-Based Tests

Test universal properties across random inputs:

```typescript
test('Property: all resolved paths stay within workspace', () => {
  fc.assert(
    fc.property(
      validPathGenerator(),
      (path) => {
        const resolved = resolveSafePath('/workspace', path);
        expect(resolved.startsWith('/workspace')).toBe(true);
      }
    ),
    { numRuns: 100 }
  );
});
```

## Commit Message Guidelines

Use clear, descriptive commit messages:

- `feat: add support for symbolic links`
- `fix: resolve path traversal vulnerability`
- `docs: update configuration examples`
- `test: add property tests for file operations`
- `refactor: simplify error handling logic`

## Documentation

- Update README.md for user-facing changes
- Update code comments for implementation changes
- Add JSDoc comments for new public APIs
- Update design.md for architectural changes

## Questions?

Feel free to open an issue for questions or join discussions!

Thank you for contributing! 🎉
