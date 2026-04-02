# Agent SKILL Framework Design

This document describes the SKILL package format aligned with the [Agent Skills Specification](https://agentskills.io/specification), as well as host-side conventions for installation, dependencies, loading, tool binding, and framework-level tools.

---

## 1. Goals & Boundaries

| Item | Convention |
|------|-----------|
| Skill format | A directory containing at least a root-level `SKILL.md`. |
| Relationship to public spec | `SKILL.md` YAML frontmatter uses fields defined by the Agent Skills Specification; host-specific extensions can go in `metadata` or separate convention files. |
| Language dependencies | Triggered by `package.json`, `requirements.txt` (and other declaration files supported by the host) in the package root; the host executes `npm install` or `pip install` in the package root directory (exact commands and policies are host-defined). |
| Environment description | Uses the spec's `compatibility` field (short text) to describe the runtime environment; when structured extensions are needed, use `metadata` for the host to interpret. |

---

## 2. Directory Structure

```
{skill-name}/                 # Directory name must match frontmatter name (spec requirement)
├── SKILL.md                  # Required: YAML frontmatter + Markdown body
├── scripts/                  # Optional: executable code
├── references/               # Optional: on-demand reference documents
├── assets/                   # Optional: templates, static resources
├── package.json              # Optional: Node.js dependency declaration
├── requirements.txt          # Optional: Python dependency declaration (or pyproject.toml, host defines priority)
└── manifest.json             # Optional: function call schema definitions
```

---

## 3. `SKILL.md`: Frontmatter

### 3.1 Fields (aligned with Agent Skills)

**Required**

- `name`: 1–64 characters, lowercase `a-z0-9-`, no leading/trailing `-`, no `--`; must match parent directory name.
- `description`: 1–1024 characters, explains what the skill does and when to use it (for routing and L0 display).

**Optional**

- `license`
- `compatibility`: ≤500 characters, describes environment (products, system commands, network, etc.).
- `metadata`: String key-value pairs; `author`, `version`, `tags`, etc.

### 3.2 Example

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

---

## 4. Body

- Markdown structure is organized by the author; recommended to include steps, examples, boundaries, and error handling.
- Reference `references/` and `scripts/` using relative paths; avoid deep nesting.
- Body should be kept at a reasonable length; long content can be split into `references/`, loaded on demand by the host via loading tools.

---

## 5. Dependency Installation

| Trigger condition (package root) | Host behavior (working directory = package root) |
|----------------------------------|--------------------------------------------------|
| `package.json` exists | Execute `npm install` (or host-policy equivalent, e.g. `npm ci`) |
| `requirements.txt` and/or other Python declaration files supported by host | Execute corresponding `pip install …` |

On skill uninstall: delete the package directory along with generated `node_modules`, virtual environment directories, etc. (policy defined by host).

---

## 6. Tool Declaration & Execution Binding (Host Layer)

The Agent Skills Specification does not define how processes are launched; this framework uses **`manifest.json`** (or YAML) in the package root alongside `SKILL.md`.

Structure example:

```json
[
  {
    "name": "search",
    "description": "Search securities by keyword or code",
    "parameters": {
      "type": "object",
      "properties": {
        "keyword": { "type": "string" }
      },
      "required": ["keyword"]
    }
  }
]
```

Conventions:

- Tool names exposed to the model should be namespaced, e.g. `skill.{name}.{tool}` (`name` matches frontmatter).
- If this file is absent, the host may fall back to scanning `scripts/` and controlled manifest generation; production environments should have authors maintain `manifest.json`.

---

## 7. Loading Levels (Host Behavior)

| Level | Content | Typical Source |
|-------|---------|----------------|
| **L0** | `name` + `description` (plus optional `license` / `compatibility` summary) | Index installed skills at startup |
| **L1** | Full `SKILL.md` body (frontmatter may be summarized) | Returned by "load main document" tool |
| **L2** | Full text of a file under `references/` | "Load reference" (valid relative path or pre-registered id) |

**Execution gating (host policy)**: For example, only allow calling a skill's `skill.*` tools after L1 is loaded; whether a tool depends on a specific reference can be expressed via `metadata` or manifest extension fields, interpreted by the host.

---

## 8. Lifecycle: Install & Uninstall

### 8.1 Install (logical order)

1. Ingest artifact → validate path safety → extract to isolated directory.
2. Locate package root (contains `SKILL.md`).
3. Validate frontmatter (per §3).
4. Validate `name` matches directory name.
5. If `package.json` exists → `npm install`; if Python declaration exists → `pip install`.
6. Read and parse tools defined in `manifest.json`.
7. Write to registry and register tools.

### 8.2 Uninstall

1. Unregister tools → stop related runtimes.
2. Delete package directory and `node_modules` / venv artifacts.
3. Update registry.

---

## 9. Framework Capabilities as Model Tools

Provided by the host as structured tools (JSON parameters); reference paths are resolved via "installed skill + valid relative path or pre-registered id" — arbitrary unvalidated absolute paths are not accepted.

| Tool (example name) | Purpose |
|---------------------|---------|
| `skill_list` | L0 list of installed skills |
| `skill_install` / `skill_uninstall` | Install / uninstall (highly sensitive, recommend ASK or policy approval) |
| `skill_load_main` | L0→L1: return main `SKILL.md` body |
| `skill_load_reference` | L1→L2: load by relative path or reference id |
| `skill_list_tools` | A skill's tool names, descriptions, and parameters |
| `skill_run_script` | Execute a skill tool script with JSON Schema validation |

Business tools use `skill.{name}.{tool}`, distinguished from the above for permission model separation.

---

## 9.1 Script Execution

Skill tool scripts are located in the `scripts/` directory. The script filename must match the tool name in `manifest.json` (e.g., tool named `search` → script `scripts/search.js`).

Execution flow:
1. Receive `args` (JSON string) from LLM
2. Validate against `manifest.json` `parameters` JSON Schema (required fields, types, enum values)
3. Pass `args` as command line argument to script: `node scripts/{toolName}.js '{...}'`
4. Script receives params via `process.argv[2]`

### CLI Command

The framework provides a `skill` command for skill management:

```bash
skill list                     # List installed skills
skill install <source>         # Install a skill (directory or zip)
skill uninstall <name>         # Uninstall a skill
skill run <skill> <tool> [args] # Run a skill tool
skill help                     # Show help
```

Customize the skills storage directory via `SKILL_HOME` environment variable:
```bash
SKILL_HOME=~/.skills skill list
```

---

## 10. Security (Summary)

- Extraction & paths: prevent zip-slip; reference paths restricted to within package root.
- `npm` / `pip`: timeout, optional mirrors; registry policy configured by host.
- `install` / `uninstall`: highly sensitive operations, recommend manual or policy confirmation.
- `compatibility` is descriptive text; whether to restrict execution based on it is determined by host policy and `metadata` extensions.

---

## 11. References

- [Agent Skills Specification](https://agentskills.io/specification)
