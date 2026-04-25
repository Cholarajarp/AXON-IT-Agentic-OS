import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerCustomerDeliveryRoutes } from './customer-delivery.js';

describe('customer delivery routes', () => {
  it('creates a customer account with project SOW, SLA, margin, report, and feedback backlog', async () => {
    const app = Fastify();
    await app.register(registerCustomerDeliveryRoutes);

    const response = await app.inject({
      method: 'POST',
      url: '/customer-delivery/accounts',
      payload: {
        customerName: 'Acme Bank',
        industry: 'Financial services',
        projectName: 'AI Banking Service Desk',
        request:
          'Build and operate a secure AI banking service desk with PostgreSQL, ServiceNow, Datadog, PCI DSS, 24x7 support, delivery report, and customer feedback backlog',
        pricingModel: 'enterprise-managed-service',
        budgetUsd: 900000,
        supportPlan: 'enterprise',
        compliance: ['PCI DSS', 'SOC 2'],
      },
    });

    expect(response.statusCode).toBe(201);
    const account = response.json();
    const project = account.projects[0];
    expect(account.customerName).toBe('Acme Bank');
    expect(account.commercialSummary.annualContractValueUsd).toBeGreaterThan(900000);
    expect(project.statementOfWork.scope).toEqual(expect.arrayContaining(['customer-facing delivery report with evidence']));
    expect(project.sla.coverage).toBe('24x7');
    expect(project.marginModel.grossMarginPercent).toBeGreaterThanOrEqual(0);
    expect(project.deliveryReport.verificationEvidence).toEqual(expect.arrayContaining(['security center scan required before release']));
    expect(project.feedbackBacklog.length).toBeGreaterThan(0);

    const reportResponse = await app.inject({
      method: 'POST',
      url: `/customer-delivery/accounts/${account.id}/projects/${project.id}/report`,
    });
    expect(reportResponse.statusCode).toBe(201);
    expect(reportResponse.json().status).toBe('ready-for-customer');

    await app.close();
  });
});
