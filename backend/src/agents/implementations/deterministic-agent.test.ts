import { describe, expect, it } from 'vitest';
import { EngineeringAgent } from './engineering.js';

describe('deterministic runtime agents', () => {
  it('returns repeatable engineering evidence for the same workflow input', async () => {
    const agent = new EngineeringAgent();
    const signal = new AbortController().signal;
    const input = {
      taskId: 'task_build_checkout',
      taskName: 'Build checkout service',
      description: 'Implement the checkout service with tests and release gates.',
      input: { repository: 'axon/customer-platform' },
      signal,
      workflowId: 'wf_checkout',
    };

    const first = await agent.execute(input);
    const second = await agent.execute(input);

    expect(second).toEqual(first);
    expect(first.output).toMatchObject({
      testsPassing: true,
      codeQuality: expect.objectContaining({ duplication: 0 }),
    });
  });
});
