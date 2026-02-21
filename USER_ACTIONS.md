# User Actions Required

These actions require manual authorization (npm commands, publishing, etc.) and could not be performed automatically.

---

## 1. Install Dependencies (REQUIRED)

Run this first to install all dependencies including the new dev/optional ones:

```bash
cd repo
npm install --legacy-peer-deps
```

This will install:
- **vitest** + **@vitest/coverage-v8** (dev) — test framework
- **@huggingface/transformers** (optional) — semantic embeddings
- **@modelcontextprotocol/sdk** (optional) — MCP server for AI assistants

---

## 2. Run Tests

After installing dependencies, verify everything works:

```bash
npm test                # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

---

## 3. Link for Global CLI Usage

To use `codegraph` as a global command:

```bash
npm link
```

---

## 4. Publish to npm (Optional)

When ready to publish:

1. Verify the package name is available: `npm search codegraph`
   - If taken, consider scoping: change `"name"` to `"@compass-soul/codegraph"` in package.json
2. Dry run: `npm publish --dry-run`
3. Publish: `npm publish --access public`

---

## 5. WASM Tree-Sitter Migration (Optional, Recommended)

The current native tree-sitter requires C++ compilers on user machines and has peer dependency conflicts.
Consider migrating to WASM-based tree-sitter:

```bash
npm install web-tree-sitter
# Then download WASM grammar files for each language
```

This eliminates the `--legacy-peer-deps` requirement and fixes Windows installation issues.

---

## 6. Install MCP SDK (Optional)

If you want the MCP server feature for AI assistant integration:

```bash
npm install @modelcontextprotocol/sdk
```

Then use: `codegraph mcp`

---

## 7. Configuration File (Optional)

Copy the example config to customize codegraph for your projects:

```bash
cp .codegraphrc.example.json your-project/.codegraphrc.json
```

Edit it to set custom ignore patterns, aliases, build options, etc.

---

## Summary of Changes Made

### Critical Fixes
- [x] **#2 Shell injection** — `execSync` replaced with `execFileSync` in diff-impact
- [x] **#3 LICENSE file** — MIT license added
- [x] **#1 Test framework** — Vitest configured with test stubs for parsers, cycles, export

### Architecture & Code Quality
- [x] **#4 Modular structure** — Shared `constants.js`, `config.js`, `logger.js` extracted
- [x] **#5 Code dedup** — `IGNORE_DIRS`/`EXTENSIONS` shared between builder and watcher
- [x] **#7 Programmatic API** — `src/index.js` created with all public exports
- [x] **#14 Error logging** — Logger utility replaces silent `catch {}` blocks
- [x] **#15 Graceful DB handling** — `openReadonlyOrFail()` with clear error messages
- [x] **#23 Schema migrations** — Version-tracked migration system in `db.js`

### Performance
- [x] **#8 Incremental builds** — File hash tracking, only re-parses changed files
- [x] **#9 Embedding pre-filter** — Filter by kind/file pattern before computing similarity
- [x] **#10 N+1 query fix** — Pre-loaded node lookup maps in edge building
- [x] **#11 Composite indexes** — Added `idx_nodes_name_kind_file`, `idx_edges_source_kind`, etc.

### New Features
- [x] **#16 Graph export** — DOT (Graphviz), Mermaid, and JSON export (`codegraph export`)
- [x] **#17 Circular deps** — Tarjan's SCC algorithm (`codegraph cycles`)
- [x] **#18 Config file** — `.codegraphrc.json` support with example
- [x] **#20 MCP server** — Skeleton for AI assistant integration (`codegraph mcp`)
- [x] **#21 CI/CD** — GitHub Action for PR impact analysis

### Developer Experience
- [x] **#13 npm publish prep** — `files`, `exports`, `engines`, `keywords`, `repository` in package.json
- [x] **#19 Windows paths** — `normalizePath()` ensures forward slashes in DB
- [x] **#22 Optional embeddings** — `@huggingface/transformers` moved to optionalDependencies
- [x] Verbose mode (`-v` flag) for debug output
- [x] New CLI commands: `export`, `cycles`, `mcp`
- [x] Search pre-filter flags: `--kind`, `--file`
- [x] Incremental build flag: `--no-incremental`

### ESM Migration (Completed)
- [x] **#6 ESM migration** — Full CommonJS-to-ESM conversion: `"type": "module"` in package.json, all `require()`/`module.exports` replaced with `import`/`export`, `.js` extensions on all local imports, `createRequire` used for CJS-only native addons (tree-sitter, better-sqlite3)

### Not Yet Implemented (Require Larger Effort)
- [ ] **#12 WASM tree-sitter** — Requires grammar WASM files and rewriting parser init
