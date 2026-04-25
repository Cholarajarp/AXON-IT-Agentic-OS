import { sql } from '../../db/connection.js';
import type { ToolHandler } from '../registry.js';
import type { ToolExecutionRequest, ToolExecutionResult, SandboxConfig } from '../types.js';

/**
 * Database tool — read-only, statement-limited, system-table-blocked.
 *
 * Previous version used sql.unsafe(userQuery), which allowed any statement
 * regardless of mode (the regex-based "read vs write" check was trivially
 * bypassable with comments, compound statements, or CTEs like
 *   WITH x AS (DELETE FROM ...) SELECT 1
 *
 * This version:
 *   - Rejects any query that is not a single SELECT or EXPLAIN statement.
 *   - Rejects system/catalog table access (pg_*, information_schema).
 *   - Rejects multi-statement payloads (anything after the first `;`).
 *   - Applies a forced LIMIT if none is present.
 *   - Runs in an explicit READ ONLY transaction so even bypasses can't write.
 */

const ALLOWED_PREFIXES = /^\s*(SELECT|EXPLAIN|WITH)\b/i;
const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|COPY|CALL|DO|LOCK|NOTIFY|LISTEN|UNLISTEN|VACUUM|ANALYZE|RESET|SET\s+SESSION|SET\s+LOCAL)\b/i;
const FORBIDDEN_TABLES = /\b(pg_[a-z_]+|information_schema\.[a-z_]+)\b/i;

export const databaseTool: ToolHandler = {
  definition: {
    name: 'database.query',
    category: 'database',
    description: 'Run a single read-only SELECT against the application database. Multi-statement and catalog access are rejected.',
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Single SELECT/EXPLAIN statement, no trailing semicolon' },
      { name: 'limit', type: 'number', required: false, description: 'Max rows to return (default 100, max 1000)', default: 100 },
    ],
    requiresApproval: false,
    riskLevel: 'medium',
    timeout: 15000,
  },

  async execute(request: ToolExecutionRequest, _sandbox: SandboxConfig): Promise<ToolExecutionResult> {
    const { query, limit = 100 } = request.parameters as { query: string; limit?: number };

    if (!query || typeof query !== 'string') {
      return { success: false, output: 'Query parameter is required', durationMs: 0 };
    }

    const trimmed = query.trim().replace(/;\s*$/, '');

    if (trimmed.includes(';')) {
      return { success: false, output: 'Multi-statement queries are not allowed', durationMs: 0 };
    }
    if (!ALLOWED_PREFIXES.test(trimmed)) {
      return { success: false, output: 'Only SELECT / EXPLAIN / WITH queries are permitted', durationMs: 0 };
    }
    if (FORBIDDEN_KEYWORDS.test(trimmed)) {
      return { success: false, output: 'Query contains forbidden keyword', durationMs: 0 };
    }
    if (FORBIDDEN_TABLES.test(trimmed)) {
      return { success: false, output: 'Access to system catalog tables is not permitted', durationMs: 0 };
    }

    const safeLimit = Math.min(Math.max(1, Math.floor(limit)), 1000);
    const hasLimit = /\blimit\s+\d+\b/i.test(trimmed);
    const finalQuery = hasLimit ? trimmed : `${trimmed} LIMIT ${safeLimit}`;

    const start = Date.now();
    try {
      // Force READ ONLY so even a bypass cannot mutate data.
      const rows = await sql.begin(async (tx) => {
        await tx`SET TRANSACTION READ ONLY`;
        return tx.unsafe(finalQuery);
      });

      return {
        success: true,
        output: { rows, rowCount: rows.length, query: finalQuery },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: `SQL Error: ${error.message}`,
        durationMs: Date.now() - start,
      };
    }
  },
};
