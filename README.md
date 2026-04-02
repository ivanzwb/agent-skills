# agent-skills

[![CI](https://github.com/<owner>/agent-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/<owner>/agent-skills/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[中文文档](README.zh-CN.md)

Agent SKILL framework — a skill package management, three-level progressive loading, and tool binding engine aligned with the [Agent Skills Specification](https://agentskills.io/specification).

## Features

- **Skill lifecycle management** — Install / uninstall skill packages from directories or `.zip` archives
- **Three-level progressive loading** — L0 (index summary) → L1 (full body) → L2 (reference documents)
- **Pre-install preview** — Stage to a temp directory, inspect before deciding to install or cancel
- **Automatic dependency installation** — Built-in npm / pip, extensible to any language via `IDependencyInstaller`
- **manifest.json tool declarations** — Parsed and exposed as function-call format tool definitions
- **Script execution** — Execute skill tools via `runScript()` with JSON Schema validation
- **CLI support** — `skill` command for skill management and tool execution
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
npm install agent-skills
```

### Basic Usage

```ts
import { SkillFramework } from 'agent-skills';

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

### CLI Usage

After installing the package globally (`npm link` or `npm install -g agent-skills`), you can use the `skill` command:

```bash
# List installed skills
skill list

# Install a skill
skill install ./my-skill
skill install ./my-skill.zip

# Uninstall a skill
skill uninstall my-skill

# Run a skill tool (args as JSON string)
skill run my-skill search '{"keyword":"茅台"}'
skill run my-skill kline '{"code":"600519","period":"daily","limit":60}'

# Show help
skill help
```

**Environment variables:**
- `SKILL_HOME` — Override the skills storage directory (default: `./skills` in package root)

```bash
SKILL_HOME=~/.skills skill list
```

### Script Execution (runScript)

Execute skill tool scripts programmatically with JSON Schema validation:

```ts
// Execute a tool with validated arguments
const result = await sf.runScript({
  name: 'my-skill',
  toolName: 'search',
  args: '{"keyword":"茅台"}'  // JSON string from LLM
});

console.log(result.stdout);   // Script output
console.log(result.stderr);   // Error output
console.log(result.exitCode); // Exit code
```

The `args` parameter accepts a JSON string that will be validated against the tool's `manifest.json` parameters schema:
- Required fields are checked
- Types are validated (string, number, boolean, etc.)
- Enum values are enforced

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
import { SkillFramework, IDependencyInstaller } from 'agent-skills';

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

The framework exposes 7 tools via `getFrameworkToolDeclarations()` that can be injected directly into an LLM's tools/functions list:

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

### `skill_run_script`

Execute a skill tool script. Validates args against the tool's JSON Schema and runs the script with provided parameters.

```json
{
  "name": "skill_run_script",
  "description": "Execute a skill tool script. Returns stdout/stderr as JSON strings.",
  "parameters": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Skill name" },
      "toolName": { "type": "string", "description": "Tool name declared in manifest.json" },
      "args": { "type": "string", "description": "Tool arguments as json string" }
    },
    "required": ["name", "toolName"]
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
| `runScript(params)` | Execute a skill tool script with JSON Schema validation |
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
