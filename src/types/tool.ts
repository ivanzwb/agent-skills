/** Tool declaration types from manifest.json */

/** JSON Schema-style parameter definition */
export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

/** A single tool declaration from manifest.json */
export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: ToolParameters;
}
