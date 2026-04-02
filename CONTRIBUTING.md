# Contributing to agent-skills

Thank you for your interest in contributing! Here's how you can help.

## Getting Started

```bash
git clone https://github.com/ivanzwb/agent-skills.git
cd agent-skills
npm install
npm run build
npm test
```

## Development Workflow

1. Fork and clone the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and add tests
4. Run `npm test` — the project targets 100% line coverage
5. Commit with a clear message (e.g. `feat: add cargo dependency installer`)
6. Open a Pull Request

## Code Style

- TypeScript strict mode
- No `any` unless absolutely necessary
- Export types from `src/types/`

## Reporting Issues

- Use [GitHub Issues](https://github.com/ivanzwb/agent-skills/issues)
- Include Node.js version, OS, and a minimal reproduction

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
