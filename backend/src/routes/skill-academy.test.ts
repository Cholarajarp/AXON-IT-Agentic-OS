import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerSkillAcademyRoutes } from './skill-academy.js';

describe('skill academy routes', () => {
  it('creates an agent workforce plan with roles, learning backlog, squads, and cost controls', async () => {
    const app = Fastify();
    await app.register(registerSkillAcademyRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/skill-academy/plans',
      payload: {
        objective: 'Build and operate an AI product platform with coding agents, database migration safety, SOC 2 security, Playwright QA, model routing, and managed service delivery',
        deliveryMode: 'managed-service',
        teamSize: 9,
        budgetUsdPerMonth: 85000,
        currentMaturity: 'growing',
        sources: [
          {
            title: 'GitHub Skills secure code game',
            url: 'https://github.com/skills/secure-code-game',
            type: 'github',
            domains: ['security', 'backend'],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.roles.map((role: { role: string }) => role.role)).toEqual(expect.arrayContaining([
      'Solution Architect',
      'Full Stack Engineer',
      'Database Reliability Engineer',
      'Security and Compliance Engineer',
      'Data and AI Engineer',
      'SRE and Cloud Operations Engineer',
    ]));
    expect(body.learningBacklog.length).toBeGreaterThan(0);
    expect(body.squads.map((squad: { name: string }) => squad.name)).toEqual(expect.arrayContaining(['Run and Improve Squad']));
    expect(body.costControls.length).toBeGreaterThan(0);
    expect(body.projectedProductivityLiftPercent).toBeGreaterThan(20);

    await app.close();
  });

  it('accepts new open learning sources for continuous skill updates', async () => {
    const app = Fastify();
    await app.register(registerSkillAcademyRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/skill-academy/sources',
      payload: {
        title: 'GitHub Actions learning path',
        url: 'https://github.com/skills/hello-github-actions',
        type: 'github',
        domains: ['devops', 'qa'],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      title: 'GitHub Actions learning path',
      type: 'github',
    });

    await app.close();
  });
});
