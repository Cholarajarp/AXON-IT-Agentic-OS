import { useNavigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { routeMap } from '../routes';

export type RouteKey =
  | 'companyOs'
  | 'missionControl'
  | 'marketRadar'
  | 'trustLedger'
  | 'agenticFinops'
  | 'agentProjects'
  | 'productionReadiness'
  | 'deliveryBrain'
  | 'structure'
  | 'build'
  | 'enterprise'
  | 'releaseCommand'
  | 'previewQa'
  | 'security'
  | 'checkpoints'
  | 'serviceDesk'
  | 'managedServices'
  | 'customerDelivery'
  | 'apiForge'
  | 'skillAcademy'
  | 'autonomousWorkforce'
  | 'command'
  | 'workflows'
  | 'dag'
  | 'terminal'
  | 'chat'
  | 'agents'
  | 'memory'
  | 'policies'
  | 'evidence'
  | 'incidents'
  | 'audit'
  | 'cost'
  | 'executive'
  | 'models'
  | 'blueprint'
  | 'integrations'
  | 'evaluations'
  | 'code'
  | 'tools'
  | 'pipeline'
  | 'database'
  | 'settings';

const pathToRouteKey: Record<string, RouteKey> = {
  '/company-os': 'companyOs',
  '/mission-control': 'missionControl',
  '/market-radar': 'marketRadar',
  '/trust-ledger': 'trustLedger',
  '/agentic-finops': 'agenticFinops',
  '/agent-projects': 'agentProjects',
  '/production-readiness': 'productionReadiness',
  '/delivery-brain': 'deliveryBrain',
  '/structure': 'structure',
  '/build': 'build',
  '/enterprise': 'enterprise',
  '/release-command': 'releaseCommand',
  '/preview-qa': 'previewQa',
  '/security': 'security',
  '/checkpoints': 'checkpoints',
  '/service-desk': 'serviceDesk',
  '/managed-services': 'managedServices',
  '/customer-delivery': 'customerDelivery',
  '/api-forge': 'apiForge',
  '/skill-academy': 'skillAcademy',
  '/autonomous-workforce': 'autonomousWorkforce',
  '/command': 'command',
  '/workflows': 'workflows',
  '/dag': 'dag',
  '/terminal': 'terminal',
  '/chat': 'chat',
  '/agents': 'agents',
  '/memory': 'memory',
  '/policies': 'policies',
  '/evidence': 'evidence',
  '/incidents': 'incidents',
  '/audit': 'audit',
  '/cost': 'cost',
  '/executive': 'executive',
  '/models': 'models',
  '/blueprint': 'blueprint',
  '/integrations': 'integrations',
  '/evaluations': 'evaluations',
  '/code': 'code',
  '/tools': 'tools',
  '/pipeline': 'pipeline',
  '/database': 'database',
  '/settings': 'settings',
};

export function useRouting() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentRoute = useMemo<RouteKey>(() => {
    return pathToRouteKey[location.pathname] || 'companyOs';
  }, [location.pathname]);

  const navigateToRoute = (route: RouteKey) => {
    const path = routeMap[route];
    if (path) {
      navigate(path);
    }
  };

  return {
    route: currentRoute,
    setRoute: navigateToRoute,
    navigate,
    location,
  };
}
