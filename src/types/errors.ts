/** Error classes for the SKILL framework */

export class SkillFrameworkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'SkillFrameworkError';
  }
}

export class SkillValidationError extends SkillFrameworkError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'SkillValidationError';
  }
}

export class SkillNotFoundError extends SkillFrameworkError {
  constructor(name: string) {
    super(`Skill not found: ${name}`, 'SKILL_NOT_FOUND');
    this.name = 'SkillNotFoundError';
  }
}

export class SkillSecurityError extends SkillFrameworkError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SkillSecurityError';
  }
}

export class ToolNotFoundError extends SkillFrameworkError {
  constructor(toolName: string, skillName: string) {
    super(`Tool "${toolName}" not found in skill "${skillName}"`, 'TOOL_NOT_FOUND');
    this.name = 'ToolNotFoundError';
  }
}

export class ScriptExecutionError extends SkillFrameworkError {
  constructor(message: string, public readonly stdout?: string, public readonly stderr?: string) {
    super(message, 'SCRIPT_EXECUTION_ERROR');
    this.name = 'ScriptExecutionError';
  }
}
