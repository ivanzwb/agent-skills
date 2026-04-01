# skill-framework

[![CI](https://github.com/<owner>/skill-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/skill-framework/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[中文文档](README.zh-CN.md)

Agent SKILL framework — a skill package management, three-level progressive loading, and tool binding engine aligned with the [Agent Skills Specification](https://agentskills.io/specification).

## Features

- **Skill lifecycle management** — Install / uninstall skill packages from directories or `.zip` archives
- **Three-level progressive loading** — L0 (index summary) → L1 (full body) → L2 (reference documents)
- **Pre-install preview** — Stage to a temp directory, inspect before deciding to install or cancel
- **Automatic dependency installation** — Built-in npm / pip, extensible to any language via `IDependencyInstaller`
- **manifest.json tool declarations** — Parsed and exposed as function-call format tool definitions
- **Security hardening** — Zip-slip detection, path traversal prevention, name-directory consistency validation
- **JSON persistent registry** — Tracks installed skill status

## Project Structure

```
src/
├── index.ts                         # SkillFramework unified entry point
├── types/                           # Type definitions and error classes
├── parsers/                         # SKILL.md / manifest.json parsers
├── dependencies/                    # Dependency installer abstraction (npm, pip, custom)
├── registry/                        # JSON file persistent registry
├── installer/                       # Install / uninstall / preview staging
└── tools/                           # Framework-level tool declarations (exposed to model)
```

## Getting Started

### Installation

```bash
npm install skill-framework
```

### Basic Usage

```ts
import { SkillFramework } from 'skill-framework';

// Initialize (point to skills storage directory)
const sf = SkillFramework.init('./skills');

// Install a skill
await sf.install('./my-skill');          // From directory
await sf.install('./my-skill.zip');      // From zip

// List installed skills (L0 summaries)
const { skills } = sf.listSkills();

// Load skill body (L0 → L1)
const main = sf.loadMain('my-skill');
console.log(main.body);

// Load reference document on demand (L1 → L2)
const ref = sf.loadReference('my-skill', 'references/guide.md');

// List tools declared by a skill
const tools = sf.listTools('my-skill');

// Uninstall
await sf.uninstall('my-skill');
```

### Preview Mode

```ts
// Stage to temp directory, get L0 summary and tool list
const preview = sf.previewSkill('./new-skill');
console.log(preview.name, preview.tools);

// Confirm installation
await sf.installPreviewed(preview.tempDir);

// Or cancel
sf.cancelPreview(preview.tempDir);
```

### Extending Dependency Installers

The framework includes built-in npm and pip installers. Add support for any language by implementing `IDependencyInstaller`:

```ts
import { SkillFramework, IDependencyInstaller } from 'skill-framework';

const cargoInstaller: IDependencyInstaller = {
  type: 'cargo',
  detect: (root) => fs.existsSync(path.join(root, 'Cargo.toml')),
  install: async (root, timeoutMs) => {
    // Run cargo build ...
    return { type: 'cargo', success: true, output: '' };
  },
};

const sf = SkillFramework.init('./skills', {
  dependencyInstallers: [cargoInstaller],
});
```

### Tool Declarations (for LLM Function Calling)

```ts
// Framework-level tools (skill_list, skill_install, etc.)
const frameworkTools = sf.getFrameworkToolDeclarations();

// Business tools declared by a specific skill (namespaced as skill.{name}.{tool})
const skillTools = sf.getSkillToolDeclarations('my-skill');

// All business tools across all skills
const allTools = sf.getAllSkillToolDeclarations();
```

## Framework Tool Definitions (LLM Function Calling)

The framework exposes 6 tools via `getFrameworkToolDeclarations()` that can be injected directly into an LLM's tools/functions list:

### `skill_list`

List L0 summaries (name + description) of all installed skills.

```json
{
  "name": "skill_list",
  "description": "List L0 summaries (name + description) of all installed skills",
  "parameters": { "type": "object", "properties": {}, "required": [] }
}
```

### `skill_install`

Install a skill package (directory or zip). **Sensitive operation, requires confirmation.**

```json
{
  "name": "skill_install",
  "description": "Install a skill package (directory or zip). Sensitive operation, requires confirmation.",
  "parameters": {
    "type": "object",
    "properties": {
      "source": { "type": "string", "description": "Path to the skill package (directory or .zip file)" }
    },
    "required": ["source"]
  }
}
```

### `skill_uninstall`

Uninstall an installed skill. **Sensitive operation, requires confirmation.**

```json
{
  "name": "skill_uninstall",
  "description": "Uninstall an installed skill. Sensitive operation, requires confirmation.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Skill name" }
    },
    "required": ["name"]
  }
}
```

### `skill_load_main`

Load the full SKILL.md body of a skill (L0 → L1 progressive loading).

```json
{
  "name": "skill_load_main",
  "description": "Load the full SKILL.md body of a skill (L0 to L1 progressive loading)",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Skill name" }
    },
    "required": ["name"]
  }
}
```

### `skill_load_reference`

Load a reference document from a skill by relative path (L1 → L2 progressive loading).

```json
{
  "name": "skill_load_reference",
  "description": "Load a reference document from a skill by relative path (L1 to L2 progressive loading)",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Skill name" },
      "referencePath": { "type": "string", "description": "Relative path of the reference file" }
    },
    "required": ["name", "referencePath"]
  }
}
```

### `skill_list_tools`

List all tools declared by a skill (name, description, parameters schema).

```json
{
  "name": "skill_list_tools",
  "description": "List all tools declared by a skill (name, description, parameters)",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Skill name" }
    },
    "required": ["name"]
  }
}
```

### Business Tool Namespacing

Business tools declared in a skill's `manifest.json` are automatically prefixed with `skill.{skillName}.{toolName}` to avoid cross-skill name collisions. Call `getAllSkillToolDeclarations()` to retrieve all business tool definitions at once.

## API Reference

| Method | Description |
|--------|-------------|
| `SkillFramework.init(folder, options?)` | Static factory, initializes the framework |
| `install(source)` | Install a skill from directory or zip |
| `uninstall(name)` | Uninstall a skill |
| `listSkills()` | Return L0 summaries of all installed skills |
| `hasSkill(name)` | Check if a skill is installed |
| `getSkill(name)` | Get full registry entry |
| `loadMain(name)` | Load full skill body (L1) |
| `loadReference(name, path)` | Load reference document (L2) |
| `previewSkill(source)` | Preview a skill (stage to temp directory) |
| `installPreviewed(tempDir)` | Install a previously previewed skill |
| `cancelPreview(tempDir)` | Cancel preview and clean up |
| `listTools(name)` | List tools declared by a skill |
| `getFrameworkToolDeclarations()` | Get framework-level tool declarations |
| `getSkillToolDeclarations(name)` | Get namespaced tool declarations for a skill |
| `getAllSkillToolDeclarations()` | Get all skill tool declarations |

## Skill Package Structure

```
{skill-name}/
├── SKILL.md            # Required: YAML frontmatter + Markdown body
├── manifest.json       # Optional: Tool declarations (function call schema)
├── package.json        # Optional: Node.js dependencies
├── requirements.txt    # Optional: Python dependencies
├── scripts/            # Optional: Executable code
├── references/         # Optional: On-demand reference documents
└── assets/             # Optional: Templates, static resources
```

### SKILL.md Frontmatter Example

```yaml
---
name: stock-assistant
description: Query and analyze public stock market information.
license: MIT
compatibility: Requires outbound HTTPS; recommend Node 18+ for hosted scripts.
metadata:
  author: acme
  version: "1.0.0"
---
```

## Documentation

- [Framework Design Document](doc/SKILL-Framework-Design.md)
- [框架设计文档（中文）](doc/SKILL-Framework-Design.zh-CN.md)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test (100% line coverage)
npm test
```

## License

[MIT](LICENSE)
