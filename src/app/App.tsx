import { useState } from 'react';
import { useRoutes, useNavigate } from 'react-router-dom';
import { Sidebar } from './components/sidebar';
import { TopBar } from './components/topbar';
import { CommandPalette } from './components/command-palette';
import { HelpDrawer } from './components/help-drawer';
import { StatusFooter } from './components/status-footer';
import { SubmitGoalModal } from './components/submit-goal-modal';
import { StoreProvider, ThemeProvider } from './lib/store';
import { ToastProvider, useHotkey } from './lib/toast';
import { routes, routeMap } from './routes';

function Shell() {
  const navigate = useNavigate();
  const routing = useRoutes(routes);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  useHotkey('mod+k', () => setPaletteOpen(true), []);
  useHotkey('mod+g', () => setGoalOpen(true), []);
  useHotkey('?', () => setHelpOpen(true), []);
  useHotkey('Escape', () => {
    setPaletteOpen(false);
    setHelpOpen(false);
  }, []);

  useHotkey('g', () => {
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, string> = {
        f: 'companyOs', 0: 'missionControl', 9: 'marketRadar', g: 'deliveryBrain', 6: 'agenticFinops', 7: 'productionReadiness', 1: 'structure', 3: 'apiForge', b: 'build', y: 'enterprise', 4: 'releaseCommand', 8: 'trustLedger', v: 'previewQa', u: 'security', r: 'checkpoints', q: 'serviceDesk', n: 'managedServices', 2: 'customerDelivery', t: 'skillAcademy', z: 'autonomousWorkforce', c: 'command', w: 'workflows', a: 'agents', p: 'policies',
          e: 'evidence', i: 'incidents', $: 'cost', x: 'executive',
          m: 'memory', o: 'models', l: 'blueprint', j: 'integrations',
        5: 'evaluations', k: 'code', d: 'database', s: 'settings',
      };
      const target = map[e.key.toLowerCase()];
      if (target && routeMap[target]) {
        e.preventDefault();
        navigate(routeMap[target]);
      }
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('keydown', handler, { once: true });
  }, [navigate]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-s-base text-s-primary">
      <Sidebar onOpenHelp={() => setHelpOpen(true)} />

      <div className="flex flex-1 min-w-0 flex-col overflow-hidden">
        <TopBar
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
        />

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-5">
          {routing}
        </main>

        <StatusFooter />
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSubmitGoal={() => setGoalOpen(true)}
      />
      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SubmitGoalModal open={goalOpen} onClose={() => setGoalOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <StoreProvider>
          <Shell />
        </StoreProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
