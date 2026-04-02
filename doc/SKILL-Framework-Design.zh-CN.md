# Agent SKILL 框架设计

本文描述与 [Agent Skills Specification](https://agentskills.io/specification) 对齐的 SKILL 包形态，以及宿主侧的安装、依赖、加载、工具绑定与框架类 Tools 约定。

---

## 1. 目标与边界

| 项目 | 约定 |
|------|------|
| 技能形态 | 一个目录，至少含根目录 `SKILL.md`。 |
| 与公开规范关系 | `SKILL.md` 的 YAML frontmatter 采用 Agent Skills 已定义字段；宿主专有扩展可放在 `metadata` 或单独约定文件中。 |
| 语言依赖 | 由包根下的 `package.json`、`requirements.txt`（及宿主支持的同类声明文件）触发；宿主在包根目录执行 `npm install` 或 `pip install`（具体命令与策略由宿主定义）。 |
| 环境说明 | 使用规范中的 `compatibility` 字段（短文本）描述运行环境；需要结构化扩展时可用 `metadata` 并由宿主解释。 |

---

## 2. 目录结构

```
{skill-name}/                 # 目录名须与 frontmatter name 一致（规范要求）
├── SKILL.md                  # 必填：YAML frontmatter + Markdown 正文
├── scripts/                  # 可选：可执行代码
├── references/               # 可选：按需加载的参考文档
├── assets/                   # 可选：模板、静态资源
├── package.json              # 可选：Node 依赖声明
├── requirements.txt          # 可选：Python 依赖声明（或 pyproject.toml，由宿主定义优先级）
└── manifest.json             # 可选：定义function call的 schema
```

---

## 3. `SKILL.md`：Frontmatter

### 3.1 字段（与 Agent Skills 一致）

**必填**

- `name`：1–64 字符，小写、`a-z0-9-`，不以 `-` 首尾、无 `--`；与父目录名一致。
- `description`：1–1024 字符，说明做什么、何时该用（便于路由与 L0 展示）。

**可选**

- `license`
- `compatibility`：≤500 字符，说明环境（产品、系统命令、网络等）。
- `metadata`：字符串键值；`author`、`version`、`tags` 等。

### 3.2 示例

```yaml
---
name: stock-assistant
description: 查询与简析 A 股公开信息；用户提到股票、代码、财报时使用。
license: MIT
compatibility: 需要出站 HTTPS；建议在 Node 18+ 环境运行托管脚本。
metadata:
  author: acme
  version: "1.0.0"
---
```

---

## 4. 正文（Body）

- Markdown 结构由作者组织；建议包含步骤、示例、边界与错误处理。
- 引用 `references/`、`scripts/` 时使用相对路径；层级不宜过深。
- 正文宜控制在合理长度；长文可拆入 `references/`，由宿主通过加载类工具按需注入上下文。

---

## 5. 依赖安装

| 触发条件（包根） | 宿主行为（工作目录为包根） |
|------------------|----------------------------|
| 存在 `package.json` | 执行 `npm install`（或宿主策略规定的等价命令，如 `npm ci`） |
| 存在 `requirements.txt` 和/或宿主支持的其它 Python 声明文件 | 执行对应的 `pip install …` |

卸载技能时：删除包目录及由此产生的 `node_modules`、虚拟环境目录等（策略由宿主定义）。

---

## 6. 工具声明与执行绑定（宿主层）

Agent Skills 规范不定义进程如何启动；本框架在包内约定 **`manifest.json`**（或 YAML），与 `SKILL.md` 同级。

结构示例：

```json
[
  {
    "name": "search",
    "description": "按关键词检索证券简称或代码",
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

约定：

- 暴露给模型的工具名建议命名空间化，例如 `skill.{name}.{tool}`（`name` 与 frontmatter 一致）。
- 若无此文件，宿主可采用扫描 `scripts/` 与受控生成清单等退路；生产环境推荐作者维护 `manifest.json`。

---

## 7. 加载层级（宿主行为）

| 层级 | 内容 | 典型来源 |
|------|------|----------|
| **L0** | `name` + `description`（及可选 `license` / `compatibility` 摘要） | 启动时索引已安装技能 |
| **L1** | 完整 `SKILL.md` 正文（frontmatter 可摘要化） | 「加载主文档」工具返回 |
| **L2** | `references/` 下某文件全文 | 「加载引用」（合法相对路径或预注册 id） |

**执行门控（宿主策略）**：例如仅当 L1 完成后才允许调用该技能的 `skill.*` 工具；某工具是否依赖某 reference 可由 `metadata` 或清单扩展字段表达，由宿主解释。

---

## 8. 生命周期：安装与卸载

### 8.1 安装（逻辑顺序）

1. 摄取制品 → 校验路径安全 → 展开到隔离目录。
2. 定位包根（含 `SKILL.md`）。
3. 校验 frontmatter（符合第 3 节）。
4. 校验 `name` 与目录名一致。
5. 若有 `package.json` → `npm install`；若有 Python 声明 → `pip install`。
6. 读取和解析 `manifest.json` 定义的工具。
7. 写入注册表并注册工具。

### 8.2 卸载

1. 注销工具 → 停止相关运行时。
2. 删除包目录及 `node_modules` / venv 等产物。
3. 更新注册表。

---

## 9. 框架能力作为模型 Tools

由宿主提供结构化工具（JSON 参数）；引用路径通过「已安装技能 + 合法相对路径或预注册 id」解析，不接受未校验的任意绝对路径。

| 工具（示例名） | 作用 |
|----------------|------|
| `skill_list` | 已安装技能 L0 列表 |
| `skill_install` / `skill_uninstall` | 安装 / 卸载（高敏感，建议 ASK 或策略审批） |
| `skill_load_main` | L0→L1：返回主 `SKILL.md` 正文 |
| `skill_load_reference` | L1→L2：按相对路径或 reference id 加载 |
| `skill_list_tools` | 某技能的工具名、description、parameters |
| `skill_run_script` | 执行技能工具脚本，带 JSON Schema 验证 |

业务工具为 `skill.{name}.{tool}`，与上表区分，便于权限模型分离。

---

## 9.1 脚本执行

技能工具脚本位于 `scripts/` 目录下，文件名需与 `manifest.json` 中的工具名一致（如工具名为 `search` 则脚本为 `scripts/search.js`）。

执行流程：
1. 接收 LLM 传来的 `args`（JSON 字符串）
2. 根据 `manifest.json` 中的 `parameters` 进行 JSON Schema 验证（必填字段、类型、枚举值）
3. 将 `args` 作为命令行参数传递给脚本：`node scripts/{toolName}.js '{...}'`
4. 脚本通过 `process.argv[2]` 获取参数并执行

### CLI 命令行

框架提供 `skill` 命令用于技能管理：

```bash
skill list                     # 列出已安装技能
skill install <source>         # 安装技能（目录或 zip）
skill uninstall <name>         # 卸载技能
skill run <skill> <tool> [args] # 运行技能工具
skill help                     # 显示帮助
```

可通过 `SKILL_HOME` 环境变量自定义技能存储目录：
```bash
SKILL_HOME=~/.skills skill list
```

---

## 10. 安全（摘要）

- 解压与路径：防 zip slip；引用路径限制在包根下。
- `npm` / `pip`：超时、可选镜像；registry 策略由宿主配置。
- `install` / `uninstall`：高敏感操作，建议人工或策略确认。
- `compatibility` 为说明性文字；是否据此限制执行由宿主策略与 `metadata` 等扩展决定。

---

## 11. 参考链接

- [Agent Skills Specification](https://agentskills.io/specification)
