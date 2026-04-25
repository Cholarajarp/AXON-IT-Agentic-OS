import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router-dom';

function lazyNamed<T extends ComponentType<unknown>>(
  loader: () => Promise<Record<string, T>>,
  exportName: string,
) {
  return lazy(async () => {
    const module = await loader();
    const component = module[exportName];
    if (!component) throw new Error(`Missing route export: ${exportName}`);
    return { default: component };
  });
}

const CommandCenter = lazyNamed(() => import('./surfaces/command-center'), 'CommandCenter');
const CompanyOs = lazyNamed(() => import('./surfaces/company-os'), 'CompanyOs');
const MissionControl = lazyNamed(() => import('./surfaces/mission-control'), 'MissionControl');
const MarketRadar = lazyNamed(() => import('./surfaces/market-radar'), 'MarketRadar');
const TrustLedger = lazyNamed(() => import('./surfaces/trust-ledger'), 'TrustLedger');
const AgenticFinOps = lazyNamed(() => import('./surfaces/agentic-finops'), 'AgenticFinOps');
const AgentProjects = lazyNamed(() => import('./surfaces/agent-projects'), 'AgentProjects');
const ProductionReadiness = lazyNamed(() => import('./surfaces/production-readiness'), 'ProductionReadiness');
const DeliveryBrain = lazyNamed(() => import('./surfaces/delivery-brain'), 'DeliveryBrain');
const StructureGuardian = lazyNamed(() => import('./surfaces/structure-guardian'), 'StructureGuardian');
const BuildStudio = lazyNamed(() => import('./surfaces/build-studio'), 'BuildStudio');
const EnterpriseOs = lazyNamed(() => import('./surfaces/enterprise-os'), 'EnterpriseOs');
const ReleaseCommand = lazyNamed(() => import('./surfaces/release-command'), 'ReleaseCommand');
const PreviewQa = lazyNamed(() => import('./surfaces/preview-qa'), 'PreviewQa');
const SecurityCenter = lazyNamed(() => import('./surfaces/security-center'), 'SecurityCenter');
const Checkpoints = lazyNamed(() => import('./surfaces/checkpoints'), 'Checkpoints');
const ServiceDesk = lazyNamed(() => import('./surfaces/service-desk'), 'ServiceDesk');
const ManagedServices = lazyNamed(() => import('./surfaces/managed-services'), 'ManagedServices');
const CustomerDelivery = lazyNamed(() => import('./surfaces/customer-delivery'), 'CustomerDelivery');
const ApiForge = lazyNamed(() => import('./surfaces/api-forge'), 'ApiForge');
const SkillAcademy = lazyNamed(() => import('./surfaces/skill-academy'), 'SkillAcademy');
const AutonomousWorkforce = lazyNamed(() => import('./surfaces/autonomous-workforce'), 'AutonomousWorkforce');
const Workflows = lazyNamed(() => import('./surfaces/workflows'), 'Workflows');
const Agents = lazyNamed(() => import('./surfaces/agents'), 'Agents');
const Memory = lazyNamed(() => import('./surfaces/memory'), 'Memory');
const Policies = lazyNamed(() => import('./surfaces/policies'), 'Policies');
const Evidence = lazyNamed(() => import('./surfaces/evidence'), 'Evidence');
const Incidents = lazyNamed(() => import('./surfaces/incidents'), 'Incidents');
const Cost = lazyNamed(() => import('./surfaces/cost'), 'Cost');
const Executive = lazyNamed(() => import('./surfaces/executive'), 'Executive');
const Settings = lazyNamed(() => import('./surfaces/settings'), 'Settings');
const DAGViewer = lazyNamed(() => import('./surfaces/dag-viewer'), 'DAGViewer');
const Terminal = lazyNamed(() => import('./surfaces/terminal'), 'Terminal');
const Chat = lazyNamed(() => import('./surfaces/chat'), 'Chat');
const Audit = lazyNamed(() => import('./surfaces/audit'), 'Audit');
const Models = lazyNamed(() => import('./surfaces/models'), 'Models');
const Blueprint = lazyNamed(() => import('./surfaces/blueprint'), 'Blueprint');
const Integrations = lazyNamed(() => import('./surfaces/integrations'), 'Integrations');
const Evaluations = lazyNamed(() => import('./surfaces/evaluations'), 'Evaluations');
const Tools = lazyNamed(() => import('./surfaces/tools'), 'Tools');
const Pipeline = lazyNamed(() => import('./surfaces/pipeline'), 'Pipeline');
const CodeIntelligence = lazyNamed(() => import('./surfaces/code-intelligence'), 'CodeIntelligence');
const DatabasePipeline = lazyNamed(() => import('./surfaces/database-pipeline'), 'DatabasePipeline');

function Screen({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="rounded-lg border border-s-border bg-s-surface p-6 text-s-secondary text-[13px]">
          Loading workspace...
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate to="/company-os" replace />,
  },
  {
    path: '/company-os',
    element: <Screen><CompanyOs /></Screen>,
  },
  {
    path: '/mission-control',
    element: <Screen><MissionControl /></Screen>,
  },
  {
    path: '/market-radar',
    element: <Screen><MarketRadar /></Screen>,
  },
  {
    path: '/trust-ledger',
    element: <Screen><TrustLedger /></Screen>,
  },
  {
    path: '/agentic-finops',
    element: <Screen><AgenticFinOps /></Screen>,
  },
  {
    path: '/agent-projects',
    element: <Screen><AgentProjects /></Screen>,
  },
  {
    path: '/production-readiness',
    element: <Screen><ProductionReadiness /></Screen>,
  },
  {
    path: '/delivery-brain',
    element: <Screen><DeliveryBrain /></Screen>,
  },
  {
    path: '/structure',
    element: <Screen><StructureGuardian /></Screen>,
  },
  {
    path: '/build',
    element: <Screen><BuildStudio /></Screen>,
  },
  {
    path: '/enterprise',
    element: <Screen><EnterpriseOs /></Screen>,
  },
  {
    path: '/release-command',
    element: <Screen><ReleaseCommand /></Screen>,
  },
  {
    path: '/preview-qa',
    element: <Screen><PreviewQa /></Screen>,
  },
  {
    path: '/security',
    element: <Screen><SecurityCenter /></Screen>,
  },
  {
    path: '/checkpoints',
    element: <Screen><Checkpoints /></Screen>,
  },
  {
    path: '/service-desk',
    element: <Screen><ServiceDesk /></Screen>,
  },
  {
    path: '/managed-services',
    element: <Screen><ManagedServices /></Screen>,
  },
  {
    path: '/customer-delivery',
    element: <Screen><CustomerDelivery /></Screen>,
  },
  {
    path: '/api-forge',
    element: <Screen><ApiForge /></Screen>,
  },
  {
    path: '/skill-academy',
    element: <Screen><SkillAcademy /></Screen>,
  },
  {
    path: '/autonomous-workforce',
    element: <Screen><AutonomousWorkforce /></Screen>,
  },
  {
    path: '/command',
    element: <Screen><CommandCenter /></Screen>,
  },
  {
    path: '/workflows',
    element: <Screen><Workflows /></Screen>,
  },
  {
    path: '/agents',
    element: <Screen><Agents /></Screen>,
  },
  {
    path: '/memory',
    element: <Screen><Memory /></Screen>,
  },
  {
    path: '/policies',
    element: <Screen><Policies /></Screen>,
  },
  {
    path: '/evidence',
    element: <Screen><Evidence /></Screen>,
  },
  {
    path: '/incidents',
    element: <Screen><Incidents /></Screen>,
  },
  {
    path: '/cost',
    element: <Screen><Cost /></Screen>,
  },
  {
    path: '/executive',
    element: <Screen><Executive /></Screen>,
  },
  {
    path: '/dag',
    element: <Screen><DAGViewer /></Screen>,
  },
  {
    path: '/terminal',
    element: <Screen><Terminal /></Screen>,
  },
  {
    path: '/chat',
    element: <Screen><Chat /></Screen>,
  },
  {
    path: '/audit',
    element: <Screen><Audit /></Screen>,
  },
  {
    path: '/models',
    element: <Screen><Models /></Screen>,
  },
  {
    path: '/blueprint',
    element: <Screen><Blueprint /></Screen>,
  },
  {
    path: '/integrations',
    element: <Screen><Integrations /></Screen>,
  },
  {
    path: '/evaluations',
    element: <Screen><Evaluations /></Screen>,
  },
  {
    path: '/tools',
    element: <Screen><Tools /></Screen>,
  },
  {
    path: '/code',
    element: <Screen><CodeIntelligence /></Screen>,
  },
  {
    path: '/pipeline',
    element: <Screen><Pipeline /></Screen>,
  },
  {
    path: '/database',
    element: <Screen><DatabasePipeline /></Screen>,
  },
  {
    path: '/settings',
    element: <Screen><Settings /></Screen>,
  },
  {
    path: '*',
    element: <Navigate to="/command" replace />,
  },
];

export type RoutePath =
  | '/company-os'
  | '/mission-control'
  | '/market-radar'
  | '/trust-ledger'
  | '/agentic-finops'
  | '/agent-projects'
  | '/production-readiness'
  | '/delivery-brain'
  | '/structure'
  | '/build'
  | '/enterprise'
  | '/release-command'
  | '/preview-qa'
  | '/security'
  | '/checkpoints'
  | '/service-desk'
  | '/managed-services'
  | '/customer-delivery'
  | '/api-forge'
  | '/skill-academy'
  | '/autonomous-workforce'
  | '/command'
  | '/workflows'
  | '/dag'
  | '/terminal'
  | '/chat'
  | '/agents'
  | '/memory'
  | '/policies'
  | '/evidence'
  | '/incidents'
  | '/audit'
  | '/cost'
  | '/executive'
  | '/models'
  | '/blueprint'
  | '/integrations'
  | '/evaluations'
  | '/tools'
  | '/code'
  | '/pipeline'
  | '/database'
  | '/settings';

export const routeMap: Record<string, RoutePath> = {
  companyOs: '/company-os',
  missionControl: '/mission-control',
  marketRadar: '/market-radar',
  trustLedger: '/trust-ledger',
  agenticFinops: '/agentic-finops',
  agentProjects: '/agent-projects',
  productionReadiness: '/production-readiness',
  deliveryBrain: '/delivery-brain',
  structure: '/structure',
  build: '/build',
  enterprise: '/enterprise',
  releaseCommand: '/release-command',
  previewQa: '/preview-qa',
  security: '/security',
  checkpoints: '/checkpoints',
  serviceDesk: '/service-desk',
  managedServices: '/managed-services',
  customerDelivery: '/customer-delivery',
  apiForge: '/api-forge',
  skillAcademy: '/skill-academy',
  autonomousWorkforce: '/autonomous-workforce',
  command: '/command',
  workflows: '/workflows',
  dag: '/dag',
  terminal: '/terminal',
  chat: '/chat',
  agents: '/agents',
  memory: '/memory',
  policies: '/policies',
  evidence: '/evidence',
  incidents: '/incidents',
  audit: '/audit',
  cost: '/cost',
  executive: '/executive',
  models: '/models',
  blueprint: '/blueprint',
  integrations: '/integrations',
  evaluations: '/evaluations',
  tools: '/tools',
  code: '/code',
  pipeline: '/pipeline',
  database: '/database',
  settings: '/settings',
};
