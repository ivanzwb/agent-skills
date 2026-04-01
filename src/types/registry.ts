/** Registry types */

import { SkillFrontmatter } from './skill';
import { ToolDeclaration } from './tool';

export enum SkillStatus {
  Installed = 'installed',
  Loading = 'loading',
  Error = 'error',
}

/** Registry entry representing an installed skill */
export interface SkillRegistryEntry {
  name: string;
  status: SkillStatus;
  /** Absolute path to the skill package root */
  rootPath: string;
  /** Parsed frontmatter */
  frontmatter: SkillFrontmatter;
  /** Declared tools from manifest.json (if present) */
  tools: ToolDeclaration[];
  /** Timestamp of installation */
  installedAt: string;
}
