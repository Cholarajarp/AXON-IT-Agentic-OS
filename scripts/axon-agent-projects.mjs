#!/usr/bin/env node

const apiBase = process.env.AXON_API_URL || process.env.VITE_API_URL || 'http://localhost:3001/api/v1';
const [, , commandName, ...argv] = process.argv;

const commands = {
  'competitive-report': () => request('/agent-projects/competitive-report'),
  templates: () => request('/agent-projects/templates'),
  projects: () => request('/agent-projects/projects'),
  runs: () => request('/agent-projects/runs'),
  schedules: () => request('/agent-projects/schedules'),
  executions: () => request('/agent-projects/executions'),
  jobs: () => request('/agent-projects/delivery-jobs'),
  'sdk-manifest': () => request('/agent-projects/sdk-manifest'),
  'create-from-template': () => {
    const args = parseArgs(argv);
    requireArg(args.template, '--template');
    return request('/agent-projects/projects/from-template', {
      method: 'POST',
      body: {
        templateId: args.template,
        name: args.name,
        objective: args.objective,
      },
    });
  },
  plan: () => {
    const args = parseArgs(argv);
    requireArg(args.project, '--project');
    requireArg(args.prompt, '--prompt');
    return request('/agent-projects/runs', {
      method: 'POST',
      body: {
        projectId: args.project,
        prompt: args.prompt,
        mode: args.mode || 'planning',
      },
    });
  },
  workspace: () => {
    const args = parseArgs(argv);
    requireArg(args.run, '--run');
    return request(`/agent-projects/runs/${encodeURIComponent(args.run)}/workspace-plan`, { method: 'POST' });
  },
  launch: () => {
    const args = parseArgs(argv);
    requireArg(args.run, '--run');
    return request('/agent-projects/executions', {
      method: 'POST',
      body: {
        runId: args.run,
        autonomyLevel: args.autonomy || 'supervised',
        createSandbox: Boolean(args.sandbox),
        requireHumanApproval: Boolean(args.approval),
      },
    });
  },
  dispatch: () => {
    const args = parseArgs(argv);
    return request('/agent-projects/schedules/run-due', {
      method: 'POST',
      body: {
        now: args.now || new Date().toISOString(),
        limit: args.limit ? Number(args.limit) : 10,
        launch: Boolean(args.launch),
        createSandbox: Boolean(args.sandbox),
        autonomyLevel: args.autonomy || 'supervised',
      },
    });
  },
  'worker-status': () => request('/agent-projects/worker/status'),
  'worker-tick': () => {
    const args = parseArgs(argv);
    return request('/agent-projects/worker/tick', {
      method: 'POST',
      body: {
        now: args.now || new Date().toISOString(),
        limit: args.limit ? Number(args.limit) : 10,
        launch: Boolean(args.launch),
        createSandbox: Boolean(args.sandbox),
        autonomyLevel: args.autonomy || 'supervised',
      },
    });
  },
  'worker-start': () => {
    const args = parseArgs(argv);
    return request('/agent-projects/worker/start', {
      method: 'POST',
      body: {
        intervalMs: args.interval ? Number(args.interval) : undefined,
      },
    });
  },
  'worker-stop': () => request('/agent-projects/worker/stop', { method: 'POST' }),
  'queue-job': () => {
    const args = parseArgs(argv);
    requireArg(args.run, '--run');
    return request('/agent-projects/delivery-jobs', {
      method: 'POST',
      body: {
        runId: args.run,
        autonomyLevel: args.autonomy || 'supervised',
        createSandbox: Boolean(args.sandbox),
        requireHumanApproval: Boolean(args.approval),
        executeApprovedCommands: Boolean(args.commands),
        approvedCommandIndexes: parseNumberList(args.approvedIndexes),
        requireBrowserEvidence: Boolean(args.browser),
        previewUrl: args.url,
      },
    });
  },
  'run-job': () => {
    const args = parseArgs(argv);
    requireArg(args.job, '--job');
    return request(`/agent-projects/delivery-jobs/${encodeURIComponent(args.job)}/run`, { method: 'POST' });
  },
  'job-events': () => {
    const args = parseArgs(argv);
    requireArg(args.job, '--job');
    const query = new URLSearchParams(stripUndefined({
      afterId: args.after,
      limit: args.limit,
    })).toString();
    return request(`/agent-projects/delivery-jobs/${encodeURIComponent(args.job)}/events${query ? `?${query}` : ''}`);
  },
  'job-heartbeat': () => {
    const args = parseArgs(argv);
    requireArg(args.job, '--job');
    return request(`/agent-projects/delivery-jobs/${encodeURIComponent(args.job)}/heartbeat`, {
      method: 'POST',
      body: {
        leaseOwner: args.owner,
        progress: args.progress === undefined ? undefined : Number(args.progress),
        stageId: args.stage,
        message: args.message,
      },
    });
  },
  'cancel-job': () => {
    const args = parseArgs(argv);
    requireArg(args.job, '--job');
    return request(`/agent-projects/delivery-jobs/${encodeURIComponent(args.job)}/cancel`, { method: 'POST' });
  },
  'retry-job': () => {
    const args = parseArgs(argv);
    requireArg(args.job, '--job');
    return request(`/agent-projects/delivery-jobs/${encodeURIComponent(args.job)}/retry`, { method: 'POST' });
  },
  'runtime-profile': () => {
    const args = parseArgs(argv);
    requireArg(args.project, '--project');
    return request(`/agent-projects/projects/${encodeURIComponent(args.project)}/runtime-profile`, {
      method: 'POST',
      body: { runId: args.run },
    });
  },
  'run-hook': () => {
    const args = parseArgs(argv);
    requireArg(args.project, '--project');
    requireArg(args.event, '--event');
    return request('/agent-projects/hooks/run', {
      method: 'POST',
      body: {
        projectId: args.project,
        runId: args.run,
        event: args.event,
        approved: Boolean(args.approved),
        payload: args.payload ? JSON.parse(args.payload) : undefined,
      },
    });
  },
  'pr-package': () => {
    const args = parseArgs(argv);
    requireArg(args.run, '--run');
    return request(`/agent-projects/runs/${encodeURIComponent(args.run)}/pr-package`, {
      method: 'POST',
      body: { executionId: args.execution },
    });
  },
  'fabric-plans': () => request('/agent-projects/execution-fabric/plans'),
  'fabric-jobs': () => request('/agent-projects/execution-fabric/jobs'),
  'fabric-plan': () => {
    const args = parseArgs(argv);
    requireArg(args.run, '--run');
    return request('/agent-projects/execution-fabric/plans', {
      method: 'POST',
      body: {
        runId: args.run,
        executionId: args.execution,
        provider: args.provider,
        deploymentProvider: args.deploy,
        targetEnvironment: args.env,
        maxCostUsd: args.budget ? Number(args.budget) : undefined,
        requirePullRequest: Boolean(args.pr),
        requireDeployment: Boolean(args.deploy && args.deploy !== 'none'),
        allowNetwork: Boolean(args.network || (args.deploy && args.deploy !== 'none')),
      },
    });
  },
  'fabric-run': () => {
    const args = parseArgs(argv);
    requireArg(args.plan, '--plan');
    return request('/agent-projects/execution-fabric/jobs', {
      method: 'POST',
      body: {
        planId: args.plan,
        approved: Boolean(args.approved),
        dryRun: !args.live,
        providedSecrets: args.secrets ? String(args.secrets).split(',').map((item) => item.trim()).filter(Boolean) : undefined,
      },
    });
  },
  'fabric-events': () => {
    const args = parseArgs(argv);
    requireArg(args.job, '--job');
    const query = new URLSearchParams(stripUndefined({
      afterId: args.after,
      limit: args.limit,
    })).toString();
    return request(`/agent-projects/execution-fabric/jobs/${encodeURIComponent(args.job)}/events${query ? `?${query}` : ''}`);
  },
  'fabric-heartbeat': () => {
    const args = parseArgs(argv);
    requireArg(args.job, '--job');
    return request(`/agent-projects/execution-fabric/jobs/${encodeURIComponent(args.job)}/heartbeat`, {
      method: 'POST',
      body: {
        leaseOwner: args.owner,
        progress: args.progress === undefined ? undefined : Number(args.progress),
        stageId: args.stage,
        message: args.message,
      },
    });
  },
  'run-command': () => {
    const args = parseArgs(argv);
    requireArg(args.execution, '--execution');
    return request(`/agent-projects/executions/${encodeURIComponent(args.execution)}/commands`, {
      method: 'POST',
      body: {
        commandIndex: args.index === undefined ? undefined : Number(args.index),
        command: args.command,
        approved: Boolean(args.approved),
        timeoutMs: args.timeout ? Number(args.timeout) : undefined,
      },
    });
  },
  'browser-evidence': () => {
    const args = parseArgs(argv);
    requireArg(args.execution, '--execution');
    return request(`/agent-projects/executions/${encodeURIComponent(args.execution)}/browser-evidence`, {
      method: 'POST',
      body: {
        targetUrl: args.url,
        htmlSnapshot: args.html,
      },
    });
  },
  recap: () => {
    const args = parseArgs(argv);
    requireArg(args.run, '--run');
    return request(`/agent-projects/runs/${encodeURIComponent(args.run)}/recap`, { method: 'POST' });
  },
  'delivery-pack': () => {
    const args = parseArgs(argv);
    requireArg(args.execution, '--execution');
    return request(`/agent-projects/executions/${encodeURIComponent(args.execution)}/delivery-pack`, { method: 'POST' });
  },
};

if (!commandName || commandName === 'help' || commandName === '--help') {
  printHelp();
  process.exit(0);
}

if (!commands[commandName]) {
  console.error(`Unknown command: ${commandName}`);
  printHelp();
  process.exit(1);
}

commands[commandName]()
  .then((data) => {
    console.log(JSON.stringify(data, null, 2));
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(stripUndefined(options.body)) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `HTTP ${response.status}`);
  }
  return payload;
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function requireArg(value, name) {
  if (!value) throw new Error(`${name} is required`);
}

function stripUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function parseNumberList(value) {
  if (!value || value === true) return undefined;
  return String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0);
}

function printHelp() {
  console.log(`AXON Agent Projects CLI

Usage:
  npm run axon -- competitive-report
  npm run axon -- templates
  npm run axon -- create-from-template --template template_saas_delivery
  npm run axon -- projects
  npm run axon -- jobs
  npm run axon -- plan --project apj_x --prompt "/goal build production feature"
  npm run axon -- workspace --run apr_x
  npm run axon -- launch --run apr_x --autonomy supervised --sandbox
  npm run axon -- queue-job --run apr_x --browser
  npm run axon -- run-job --job job_x
  npm run axon -- job-events --job job_x --limit 25
  npm run axon -- job-heartbeat --job job_x --owner WebOperator --progress 55 --stage commands
  npm run axon -- cancel-job --job job_x
  npm run axon -- retry-job --job job_x
  npm run axon -- runtime-profile --project apj_x --run apr_x
  npm run axon -- run-hook --project apj_x --event loop-stop --approved
  npm run axon -- pr-package --run apr_x --execution apx_x
  npm run axon -- fabric-plan --run apr_x --provider github-actions --deploy vercel --env staging --budget 30 --pr
  npm run axon -- fabric-run --plan xfp_x
  npm run axon -- fabric-run --plan xfp_x --approved --live --secrets GITHUB_TOKEN,VERCEL_TOKEN
  npm run axon -- fabric-events --job xfj_x
  npm run axon -- fabric-heartbeat --job xfj_x --owner ReleaseOperator --progress 70 --stage provider-run
  npm run axon -- dispatch --launch --autonomy supervised
  npm run axon -- worker-tick --launch --autonomy supervised
  npm run axon -- run-command --execution apx_x --index 0 --approved
  npm run axon -- browser-evidence --execution apx_x --url http://localhost:5173
  npm run axon -- recap --run apr_x
  npm run axon -- delivery-pack --execution apx_x
  npm run axon -- sdk-manifest

Environment:
  AXON_API_URL=http://localhost:3001/api/v1
`);
}
