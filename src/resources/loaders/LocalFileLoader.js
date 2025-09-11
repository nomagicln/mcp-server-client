import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export default class LocalFileLoader {
  constructor(options = {}) {
    this.files = options.files || [];
  }

  async loadResources() {
    const resources = [];
    const errors = [];
    // Load each configured file and parse definitions
    for (const file of this.files) {
      try {
        const raw = await fs.readFile(file, 'utf8');
        const ext = path.extname(file).toLowerCase();
        let data;
        if (ext === '.yaml' || ext === '.yml') {
          data = parseYaml(raw);
        } else if (ext === '.json') {
          data = JSON.parse(raw);
        } else {
          // Try YAML first, then JSON
          try {
            data = parseYaml(raw);
          } catch (e) {
            data = JSON.parse(raw);
          }
        }
        if (Array.isArray(data)) {
          resources.push(...data);
        } else if (data) {
          resources.push(data);
        }
      } catch (err) {
        errors.push({ file, message: err.message });
      }
    }
    return { success: errors.length === 0, resources, errors };
  }
}
