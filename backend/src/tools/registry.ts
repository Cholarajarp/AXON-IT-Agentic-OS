import type { ToolDefinition, ToolExecutionRequest, ToolExecutionResult, SandboxConfig } from './types.js';
import { shellTool } from './implementations/shell.js';
import { httpTool } from './implementations/http.js';
import { fileTool } from './implementations/file.js';
import { gitTool } from './implementations/git.js';
import { databaseTool } from './implementations/database.js';
import { codeTool } from './implementations/code.js';

export interface ToolHandler {
  definition: ToolDefinition;
  execute(request: ToolExecutionRequest, sandbox: SandboxConfig): Promise<ToolExecutionResult>;
}

class ToolRegistry {
  private tools = new Map<string, ToolHandler>();
  private executionLog: Array<{ request: ToolExecutionRequest; result: ToolExecutionResult; timestamp: number }> = [];

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults() {
    const defaults: ToolHandler[] = [
      shellTool,
      httpTool,
      fileTool,
      gitTool,
      databaseTool,
      codeTool,
    ];
    for (const tool of defaults) {
      this.tools.set(tool.definition.name, tool);
    }
  }

  register(handler: ToolHandler) {
    this.tools.set(handler.definition.name, handler);
  }

  get(name: string): ToolHandler | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((h) => h.definition);
  }

  listByCategory(category: string): ToolDefinition[] {
    return this.list().filter((t) => t.category === category);
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const handler = this.tools.get(request.toolName);
    if (!handler) {
      return { success: false, output: `Tool not found: ${request.toolName}`, durationMs: 0 };
    }

    if (handler.definition.requiresApproval && !request.sandboxed) {
      return {
        success: false,
        output: 'This tool requires approval before execution',
        durationMs: 0,
        sideEffects: ['approval_required'],
      };
    }

    const sandbox: SandboxConfig = {
      maxExecutionTime: handler.definition.timeout,
      maxMemoryMb: 512,
      allowNetwork: handler.definition.category === 'http' || handler.definition.category === 'cloud',
      allowFileSystem: handler.definition.category === 'file' || handler.definition.category === 'git',
      workingDirectory: `/tmp/axon/${request.workflowId}`,
    };

    const start = Date.now();
    try {
      const result = await handler.execute(request, sandbox);
      const logged = { request, result, timestamp: Date.now() };
      this.executionLog.push(logged);
      if (this.executionLog.length > 1000) this.executionLog.shift();
      return result;
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        output: error.message,
        stderr: error.stack,
        durationMs: Date.now() - start,
      };
    }
  }

  getExecutionLog(limit = 50) {
    return this.executionLog.slice(-limit);
  }

  getStats() {
    const total = this.executionLog.length;
    const successful = this.executionLog.filter((e) => e.result.success).length;
    const byTool = new Map<string, number>();
    for (const entry of this.executionLog) {
      byTool.set(entry.request.toolName, (byTool.get(entry.request.toolName) || 0) + 1);
    }
    return {
      totalExecutions: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      byTool: Object.fromEntries(byTool),
      registeredTools: this.tools.size,
    };
  }
}

export const toolRegistry = new ToolRegistry();
