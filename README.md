# agent-skills

[![CI](https://github.com/ivanzwb/agent-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/ivanzwb/agent-skills/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agent-skills.svg)](https://www.npmjs.com/package/agent-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

[中文文档](README.zh-CN.md)

> A TypeScript framework for managing AI agent skill packages — install, load, and bind tools for LLM function calling.

Agent SKILL framework — a skill package management, three-level progressive loading, and tool binding engine aligned with the [Agent Skills Specification](https://agentskills.io/specification).

## Why agent-skills?

Building AI agents that use tools (function calling) often means writing glue code for every new capability. **agent-skills** solves this by providing a standardised skill package format and a runtime engine that handles the full lifecycle:

| Pain Point | How agent-skills Helps |
|---|---|
| Manual tool registration for each LLM | Declare tools once in `manifest.json`, bind to any model |
| Monolithic prompt files grow unmanageable | Three-level progressive loading (L0 → L1 → L2) keeps context minimal |
| No standard for packaging agent capabilities | Follows the open [Agent Skills Specification](https://agentskills.io/specification) |
| Dependency hell across languages | Built-in npm & pip installers; extensible to Cargo, Go modules, etc. |
| Security risks with zip / path inputs | Zip-slip detection, path traversal prevention, name-directory validation |

### Use Cases

- **Copilot / ChatGPT plugin authors**: Package tools as skill packages and distribute them via npm or zip.
- **AI agent developers**: Dynamically install and bind new capabilities at runtime without redeployment.
- **Enterprise teams**: Maintain a curated skill registry with security-hardened installation.
- **LLM application builders**: Expose function-call tools to OpenAI, Claude, Gemini, or any model that supports tool use.

## Features

- **Skill lifecycle management** — Install / uninstall skill packages from directories, `.zip` archives, GitHub repos, or ClawHub registry
- **Network search & install** — Search skills across GitHub and ClawHub, install by `owner/repo` or slug
- **Three-level progressive loading** — L0 (index summary) → L1 (full body) → L2 (reference documents)
- **Pre-install preview** — Stage to a temp directory, inspect before deciding to install or cancel
- **Automatic dependency installation** — Built-in npm / pip, extensible to any language via `IDependencyInstaller`
- **manifest.json tool declarations** — Parsed and exposed as function-call format tool definitions
- **Script execution** — Execute skill tools via `runScript()` with JSON Schema validation
- **CLI support** — `skill` command for skill management, search, and tool execution
- **Security hardening** — Zip-slip detection, path traversal prevention, auto-rename to match skill name
- **JSON persistent registry** — Tracks installed skill status
- **Automatic temp cleanup** — Download and preview directories are cleaned up after install

## Project Structure

```
src/
├── index.ts                         # SkillFramework unified entry point
├── types/                           # Type definitions and error classes
├── parsers/                         # SKILL.md / manifest.json parsers
├── dependencies/                    # Dependency installer abstraction (npm, pip, custom)
├── finder/                          # Network search (GitHub + ClawHub) and download
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

// Search for skills across GitHub and ClawHub
const results = await SkillFramework.searchSkills('stock');

// Install from network (GitHub owner/repo or ClawHub slug)
await sf.installFromNetwork('owner/repo');      // From GitHub
await sf.installFromNetwork('my-skill-slug');   // From ClawHub

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

# Show detailed content of one installed skill
skill show my-skill

# Search for skills (GitHub + ClawHub)
skill find stock-analysis

# Install a skill
skill install ./my-skill              # From local directory
skill install ./my-skill.zip           # From zip
skill install owner/repo               # From GitHub
skill install my-skill-slug            # From ClawHub

# Preview a skill before installing
skill preview owner/repo

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

**Project-level configuration:**
- Set a project-specific skills directory (saved to `.skillrc` in current working directory):

```bash
skill --set-skills-dir ./my-skills
```

After setting, subsequent `skill` commands in the same project will automatically use `./my-skills`. The config is stored in `.skillrc` in the project root.

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

// Business tools declared by a specific skill (namespaced as skill__{name}__{tool})
const skillTools = sf.getSkillToolDeclarations('my-skill');

// All business tools across all skills
const allTools = sf.getAllSkillToolDeclarations();

// Parse namespaced business tool name
const parsed = sf.parseNamespacedToolName('skill__my-skill__search');
// -> { skillName: 'my-skill', toolName: 'search' }
```

## Framework Tool Definitions (LLM Function Calling)

The framework exposes 10 tools via `getFrameworkToolDeclarations()` that can be injected directly into an LLM's tools/functions list:

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

### `skill_search`

Search for skills across all sources (GitHub and ClawHub). Returns results sorted by popularity.

```json
{
  "name": "skill_search",
  "description": "Search for skills across all sources (GitHub and ClawHub). Returns a list sorted by popularity.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Search query string" }
    },
    "required": ["query"]
  }
}
```

### `skill_install_from_network`

Install a skill from the network. Accepts GitHub `owner/repo` or a ClawHub slug. **Sensitive operation, requires confirmation.**

```json
{
  "name": "skill_install_from_network",
  "description": "Install a skill from the network. Accepts GitHub owner/repo (e.g. \"owner/repo\") or a ClawHub slug (e.g. \"my-skill\"). Sensitive operation, requires confirmation.",
  "parameters": {
    "type": "object",
    "properties": {
      "source": { "type": "string", "description": "GitHub owner/repo or ClawHub slug" }
    },
    "required": ["source"]
  }
}
```

### `skill_preview_from_network`

Preview a skill from the network before installation. Accepts GitHub `owner/repo` or ClawHub slug.

```json
{
  "name": "skill_preview_from_network",
  "description": "Preview a skill from the network before installation. Accepts GitHub owner/repo or ClawHub slug.",
  "parameters": {
    "type": "object",
    "properties": {
      "source": { "type": "string", "description": "GitHub owner/repo or ClawHub slug" }
    },
    "required": ["source"]
  }
}
```

### Business Tool Namespacing

Business tools declared in a skill's `manifest.json` are automatically prefixed with `skill__{skillName}__{toolName}` to avoid cross-skill name collisions and model truncation on dotted names. Call `getAllSkillToolDeclarations()` to retrieve all business tool definitions at once.

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
| `SkillFramework.searchSkills(query)` | Search for skills across GitHub and ClawHub |
| `installFromNetwork(source)` | Install from GitHub `owner/repo` or ClawHub slug |
| `previewSkillFromNetwork(source)` | Preview from GitHub `owner/repo` or ClawHub slug |
| `listTools(name)` | List tools declared by a skill |
| `runScript(params)` | Execute a skill tool script with JSON Schema validation |
| `getFrameworkToolDeclarations()` | Get framework-level tool declarations |
| `getSkillToolDeclarations(name)` | Get namespaced tool declarations for a skill |
| `getAllSkillToolDeclarations()` | Get all skill tool declarations |
| `parseNamespacedToolName(name)` | Parse namespaced tool name into `{ skillName, toolName }` |

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

## Related Projects & Alternatives

If you are exploring the AI agent tooling ecosystem, you might also be interested in:

- [LangChain](https://github.com/langchain-ai/langchain) — LLM application framework with tool/agent abstractions
- [Semantic Kernel](https://github.com/microsoft/semantic-kernel) — Microsoft's SDK for integrating LLMs with plugins
- [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) — Autonomous AI agent experiment
- [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) — Open protocol for connecting AI models to external tools

**agent-skills** is focused specifically on **skill package management and tool binding** — it complements these frameworks rather than replacing them.

## GitHub Topics

When starring or forking this repo, consider adding these topics to your fork for better discoverability:

`ai-agent` · `agent-framework` · `llm-tools` · `function-calling` · `tool-use` · `skill-framework` · `typescript` · `ai` · `chatgpt` · `copilot` · `openai` · `claude` · `mcp` · `plugin-system` · `agent-skills`
