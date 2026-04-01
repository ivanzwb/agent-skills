/** Skill data types: frontmatter, document, loading levels, preview */

/** SKILL.md YAML frontmatter fields */
export interface SkillFrontmatter {
  /** 1–64 chars, lowercase a-z0-9-, no leading/trailing dash, no double dash */
  name: string;
  /** 1–1024 chars, what the skill does and when to use it */
  description: string;
  /** SPDX license identifier */
  license?: string;
  /** ≤500 chars, environment description */
  compatibility?: string;
  /** String key-value pairs: author, version, tags, etc. */
  metadata?: Record<string, string>;
}

/** Parsed SKILL.md: frontmatter + markdown body */
export interface SkillDocument {
  frontmatter: SkillFrontmatter;
  body: string;
}

/** L0: lightweight index entry */
export interface SkillL0 {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
}

/** Tool summary: name + description only */
export interface ToolSummary {
  name: string;
  description: string;
}

/** Preview info: L0 summary + tool list + staged temp directory */
export interface SkillPreview extends SkillL0 {
  tools: ToolSummary[];
  /** Temporary directory where the skill was staged for preview */
  tempDir: string;
}

/** L1: full SKILL.md content loaded */
export interface SkillL1 extends SkillL0 {
  body: string;
  metadata?: Record<string, string>;
}

/** L2: specific reference file content */
export interface SkillReference {
  skillName: string;
  referencePath: string;
  content: string;
}
