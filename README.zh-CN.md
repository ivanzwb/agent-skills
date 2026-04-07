# agent-skills

[![CI](https://github.com/ivanzwb/agent-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/ivanzwb/agent-skills/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agent-skills.svg)](https://www.npmjs.com/package/agent-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-green.svg)](https://nodejs.org/)

[English](README.md)

> 一个用于管理 AI Agent 技能包的 TypeScript 框架 —— 安装、加载、绑定工具，支持大模型 function calling。

Agent SKILL 框架 —— 与 [Agent Skills Specification](https://agentskills.io/specification) 对齐的技能包管理、三级加载与工具绑定引擎。

## 为什么选择 agent-skills？

构建使用工具（function calling）的 AI Agent 通常需要为每个新功能编写胶水代码。**agent-skills** 提供了标准化的技能包格式和运行时引擎，覆盖完整生命周期：

| 痛点 | agent-skills 如何解决 |
|---|---|
| 每个 LLM 都要手动注册工具 | 在 `manifest.json` 中声明一次，绑定到任意模型 |
| 单一 prompt 文件越来越臃肿 | 三级渐进加载（L0 → L1 → L2）保持上下文最小化 |
| Agent 能力缺乏标准打包方式 | 遵循开放的 [Agent Skills Specification](https://agentskills.io/specification) |
| 跨语言依赖管理困难 | 内置 npm / pip 安装器，可扩展至 Cargo、Go modules 等 |
| zip / 路径输入存在安全风险 | zip-slip 检测、路径遍历拦截、名称-目录一致性校验 |

### 适用场景

- **Copilot / ChatGPT 插件作者**：将工具打包为技能包，通过 npm 或 zip 分发。
- **AI Agent 开发者**：运行时动态安装和绑定新能力，无需重新部署。
- **企业团队**：维护经过安全加固的技能注册表。
- **大模型应用开发者**：向 OpenAI、Claude、Gemini 或任何支持 tool use 的模型暴露 function-call 工具。

## 功能特性

- **技能生命周期管理** — 从目录、`.zip`、GitHub 仓库或 ClawHub 注册表安装 / 卸载技能包
- **网络搜索与安装** — 跨 GitHub 和 ClawHub 搜索技能，通过 `owner/repo` 或 slug 安装
- **三级渐进加载** — L0（索引摘要）→ L1（完整正文）→ L2（引用文档）
- **安装前预览** — 暂存到临时目录，检视后再决定安装或取消
- **自动依赖安装** — 内置 npm / pip，支持通过 `IDependencyInstaller` 扩展任意语言
- **manifest.json 工具声明** — 解析并暴露为 function-call 格式的工具定义
- **脚本执行** — 通过 `runScript()` 执行技能工具，支持 JSON Schema 验证
- **命令行支持** — `skill` 命令用于技能管理、搜索和工具执行
- **安全防护** — zip-slip 检测、路径遍历拦截、自动重命名目录匹配技能名
- **JSON 持久化注册表** — 跟踪已安装技能状态
- **自动清理临时文件** — 安装完成后自动清理下载和预览目录

## 项目结构

```
src/
├── index.ts                         # SkillFramework 统一入口
├── types/                           # 类型定义与错误类
├── parsers/                         # SKILL.md / manifest.json 解析器
├── dependencies/                    # 依赖安装抽象（npm、pip、自定义）
├── finder/                          # 网络搜索（GitHub + ClawHub）与下载
├── registry/                        # JSON 文件持久化注册表
├── installer/                       # 安装 / 卸载 / 预览暂存
└── tools/                           # 框架级工具声明（暴露给模型）
```

## 快速开始

### 安装

```bash
npm install agent-skills
```

### 基本使用

```ts
import { SkillFramework } from 'agent-skills';

// 初始化（指向技能存储目录）
const sf = SkillFramework.init('./skills');

// 安装技能
await sf.install('./my-skill');          // 从目录
await sf.install('./my-skill.zip');      // 从 zip

// 搜索技能（GitHub + ClawHub）
const results = await SkillFramework.searchSkills('stock');

// 从网络安装（GitHub owner/repo 或 ClawHub slug）
await sf.installFromNetwork('owner/repo');      // 从 GitHub
await sf.installFromNetwork('my-skill-slug');   // 从 ClawHub

// 列出已安装技能（L0 摘要）
const { skills } = sf.listSkills();

// 加载技能正文（L0 → L1）
const main = sf.loadMain('my-skill');
console.log(main.body);

// 按需加载引用文档（L1 → L2）
const ref = sf.loadReference('my-skill', 'references/guide.md');

// 列出技能声明的工具
const tools = sf.listTools('my-skill');

// 卸载
await sf.uninstall('my-skill');
```

### 命令行工具

全局安装后（`npm link` 或 `npm install -g agent-skills`），可使用 `skill` 命令：

```bash
# 列出已安装技能
skill list

# 搜索技能（GitHub + ClawHub）
skill find stock-analysis

# 安装技能
skill install ./my-skill              # 从本地目录
skill install ./my-skill.zip           # 从 zip
skill install owner/repo               # 从 GitHub
skill install my-skill-slug            # 从 ClawHub

# 预览技能（安装前检视）
skill preview owner/repo

# 卸载技能
skill uninstall my-skill

# 运行技能工具（参数为 JSON 字符串）
skill run my-skill search '{"keyword":"茅台"}'
skill run my-skill kline '{"code":"600519","period":"daily","limit":60}'

# 显示帮助
skill help
```

**环境变量：**
- `SKILL_HOME` — 自定义技能存储目录（默认：包根目录下的 `./skills`）

```bash
SKILL_HOME=~/.skills skill list
```

### 脚本执行（runScript）

通过 JSON Schema 验证执行技能工具脚本：

```ts
// 执行工具并验证参数
const result = await sf.runScript({
  name: 'my-skill',
  toolName: 'search',
  args: '{"keyword":"茅台"}'  // 来自 LLM 的 JSON 字符串
});

console.log(result.stdout);   // 脚本输出
console.log(result.stderr);   // 错误输出
console.log(result.exitCode); // 退出码
```

`args` 参数接受 JSON 字符串，会根据工具的 `manifest.json` 参数 schema 进行验证：
- 检查必填字段
- 验证类型（string、number、boolean 等）
- 校验枚举值

### 预览模式

```ts
// 暂存到临时目录，获取 L0 摘要与工具列表
const preview = sf.previewSkill('./new-skill');
console.log(preview.name, preview.tools);

// 确认安装
await sf.installPreviewed(preview.tempDir);

// 或取消
sf.cancelPreview(preview.tempDir);
```

### 扩展依赖安装器

框架内置 npm 和 pip 安装器，可通过实现 `IDependencyInstaller` 添加任意语言支持：

```ts
import { SkillFramework, IDependencyInstaller } from 'agent-skills';

const cargoInstaller: IDependencyInstaller = {
  type: 'cargo',
  detect: (root) => fs.existsSync(path.join(root, 'Cargo.toml')),
  install: async (root, timeoutMs) => {
    // 执行 cargo build ...
    return { type: 'cargo', success: true, output: '' };
  },
};

const sf = SkillFramework.init('./skills', {
  dependencyInstallers: [cargoInstaller],
});
```

### 工具声明（用于模型 function calling）

```ts
// 框架级工具（skill_list, skill_install 等）
const frameworkTools = sf.getFrameworkToolDeclarations();

// 特定技能声明的业务工具（带 skill.{name}.{tool} 命名空间）
const skillTools = sf.getSkillToolDeclarations('my-skill');

// 所有技能的业务工具
const allTools = sf.getAllSkillToolDeclarations();
```

## 框架工具定义（LLM Function Calling）

框架通过 `getFrameworkToolDeclarations()` 暴露以下 10 个工具，可直接注入大模型的 tools/functions 列表：

### `skill_list`

列出所有已安装技能的 L0 摘要（name + description）。

```json
{
  "name": "skill_list",
  "description": "List L0 summaries (name + description) of all installed skills",
  "parameters": { "type": "object", "properties": {}, "required": [] }
}
```

### `skill_install`

安装一个技能包（目录或 zip）。**高敏感操作，需确认。**

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

卸载一个已安装的技能。**高敏感操作，需确认。**

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

加载技能的完整 SKILL.md 正文（L0 → L1 渐进加载）。

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

按相对路径加载技能的引用文档（L1 → L2 渐进加载）。

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

列出某技能声明的所有工具（名称、描述、参数 schema）。

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

执行技能工具脚本。根据工具的 JSON Schema 验证参数后运行脚本。

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

跨所有源（GitHub 和 ClawHub）搜索技能，按流行度排序返回。

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

从网络安装技能。支持 GitHub `owner/repo` 或 ClawHub slug。**高敏感操作，需确认。**

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

安装前从网络预览技能。支持 GitHub `owner/repo` 或 ClawHub slug。

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

### 业务工具命名空间

技能通过 `manifest.json` 声明的业务工具会被框架自动加上命名空间前缀 `skill.{skillName}.{toolName}`，避免跨技能名称冲突。调用 `getAllSkillToolDeclarations()` 可一次性获取所有技能的业务工具定义。

## API 概览

| 方法 | 说明 |
|------|------|
| `SkillFramework.init(folder, options?)` | 静态工厂，初始化框架 |
| `install(source)` | 从目录或 zip 安装技能 |
| `uninstall(name)` | 卸载技能 |
| `listSkills()` | 返回所有已安装技能的 L0 摘要 |
| `hasSkill(name)` | 检查技能是否已安装 |
| `getSkill(name)` | 获取完整注册表条目 |
| `loadMain(name)` | 加载技能完整正文（L1） |
| `loadReference(name, path)` | 加载引用文档（L2） |
| `previewSkill(source)` | 预览技能（暂存到临时目录） |
| `installPreviewed(tempDir)` | 安装已预览的技能 |
| `cancelPreview(tempDir)` | 取消预览并清理 |
| `SkillFramework.searchSkills(query)` | 跨 GitHub 和 ClawHub 搜索技能 |
| `installFromNetwork(source)` | 从 GitHub `owner/repo` 或 ClawHub slug 安装 |
| `previewSkillFromNetwork(source)` | 从 GitHub `owner/repo` 或 ClawHub slug 预览 |
| `listTools(name)` | 列出技能声明的工具 |
| `runScript(params)` | 执行技能工具脚本，带 JSON Schema 验证 |
| `getFrameworkToolDeclarations()` | 获取框架级工具声明 |
| `getSkillToolDeclarations(name)` | 获取特定技能的命名空间工具声明 |
| `getAllSkillToolDeclarations()` | 获取所有技能的工具声明 |

## 技能包结构

```
{skill-name}/
├── SKILL.md            # 必填：YAML frontmatter + Markdown 正文
├── manifest.json       # 可选：工具声明（function call schema）
├── package.json        # 可选：Node.js 依赖
├── requirements.txt    # 可选：Python 依赖
├── scripts/            # 可选：可执行代码
├── references/         # 可选：按需加载的参考文档
└── assets/             # 可选：模板、静态资源
```

### SKILL.md frontmatter 示例

```yaml
---
name: stock-assistant
description: 查询与简析 A 股公开信息；用户提到股票、代码、财报时使用。
license: MIT
compatibility: 需要出站 HTTPS；建议在 Node 18+ 环境运行。
metadata:
  author: acme
  version: "1.0.0"
---
```

## 文档

- [框架设计文档（中文）](doc/SKILL-Framework-Design.zh-CN.md)
- [Framework Design Document (English)](doc/SKILL-Framework-Design.md)

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 测试（100% 行覆盖率）
npm test
```

## License

[MIT](LICENSE)

## 相关项目

如果你在探索 AI Agent 工具生态，以下项目可能也有帮助：

- [LangChain](https://github.com/langchain-ai/langchain) — LLM 应用框架，提供工具 / Agent 抽象
- [Semantic Kernel](https://github.com/microsoft/semantic-kernel) — 微软的 LLM 插件 SDK
- [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) — 自主 AI Agent 实验项目
- [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) — 连接 AI 模型与外部工具的开放协议

**agent-skills** 专注于 **技能包管理与工具绑定** —— 与这些框架互补，而非替代。
