/** Framework tool parameter types */

import { SkillL0 } from './skill';

/** Result shape for skill_list */
export interface SkillListResult {
  skills: SkillL0[];
}

/** Parameters for skill_install */
export interface SkillInstallParams {
  /** Path to the skill package (directory or zip) */
  source: string;
}

/** Parameters for skill_uninstall */
export interface SkillUninstallParams {
  name: string;
}

/** Parameters for skill_load_main */
export interface SkillLoadMainParams {
  name: string;
}

/** Parameters for skill_load_reference */
export interface SkillLoadReferenceParams {
  name: string;
  /** Relative path under the skill root, or a pre-registered reference id */
  referencePath: string;
}

/** Parameters for skill_list_tools */
export interface SkillListToolsParams {
  name: string;
}

/** Parameters for invoking a business tool */
export interface SkillToolInvokeParams {
  skillName: string;
  toolName: string;
  arguments: Record<string, unknown>;
}
