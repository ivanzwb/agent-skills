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
