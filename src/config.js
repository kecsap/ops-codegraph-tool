import fs from 'fs';
import path from 'path';
import { debug } from './logger.js';

export const CONFIG_FILES = ['.codegraphrc.json', '.codegraphrc', 'codegraph.config.json'];

export const DEFAULTS = {
  include: [],
  exclude: [],
  ignoreDirs: [],
  extensions: [],
  aliases: {},
  build: {
    incremental: true,
    dbPath: '.codegraph/graph.db'
  },
  query: {
    defaultDepth: 3,
    defaultLimit: 20
  }
};

/**
 * Load project configuration from a .codegraphrc.json or similar file.
 * Returns merged config with defaults.
 */
export function loadConfig(cwd) {
  cwd = cwd || process.cwd();
  for (const name of CONFIG_FILES) {
    const filePath = path.join(cwd, name);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const config = JSON.parse(raw);
        debug(`Loaded config from ${filePath}`);
        return mergeConfig(DEFAULTS, config);
      } catch (err) {
        debug(`Failed to parse config ${filePath}: ${err.message}`);
      }
    }
  }
  return { ...DEFAULTS };
}

function mergeConfig(defaults, overrides) {
  const result = { ...defaults };
  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && defaults[key] && typeof defaults[key] === 'object') {
      result[key] = { ...defaults[key], ...value };
    } else {
      result[key] = value;
    }
  }
  return result;
}
