import * as fs from 'fs';
import * as path from 'path';
import {
  SkillRegistryEntry,
  SkillStatus,
  SkillNotFoundError,
} from '../types';

const REGISTRY_FILENAME = 'registry.json';

/**
 * Persistent registry of installed skills.
 * Backed by a JSON file in the skills storage directory.
 */
export class SkillRegistry {
  private entries: Map<string, SkillRegistryEntry> = new Map();
  private readonly registryPath: string;

  constructor(storageDir: string) {
    this.registryPath = path.join(storageDir, REGISTRY_FILENAME);
    this.load();
  }

  /** Load registry from disk. Creates empty registry if file doesn't exist. */
  private load(): void {
    if (!fs.existsSync(this.registryPath)) {
      this.entries = new Map();
      return;
    }

    try {
      const raw = fs.readFileSync(this.registryPath, 'utf-8');
      const arr: SkillRegistryEntry[] = JSON.parse(raw);
      this.entries = new Map(arr.map((e) => [e.name, e]));
    } catch {
      this.entries = new Map();
    }
  }

  /** Persist registry to disk. */
  private save(): void {
    fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
    const arr = Array.from(this.entries.values());
    fs.writeFileSync(this.registryPath, JSON.stringify(arr, null, 2), 'utf-8');
  }

  /** Register or update a skill entry */
  register(entry: SkillRegistryEntry): void {
    this.entries.set(entry.name, entry);
    this.save();
  }

  /** Unregister a skill by name */
  unregister(name: string): void {
    if (!this.entries.has(name)) {
      throw new SkillNotFoundError(name);
    }
    this.entries.delete(name);
    this.save();
  }

  /** Get a skill entry by name */
  get(name: string): SkillRegistryEntry {
    const entry = this.entries.get(name);
    if (!entry) {
      throw new SkillNotFoundError(name);
    }
    return entry;
  }

  /** Check if a skill is installed */
  has(name: string): boolean {
    return this.entries.has(name);
  }

  /** List all installed skill entries */
  listAll(): SkillRegistryEntry[] {
    return Array.from(this.entries.values());
  }

  /** Update the status of a skill */
  updateStatus(name: string, status: SkillStatus): void {
    const entry = this.get(name);
    entry.status = status;
    this.save();
  }
}
