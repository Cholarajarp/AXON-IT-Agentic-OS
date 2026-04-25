import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Braces,
  Code2,
  FileCode2,
  GitFork,
  Loader2,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Sigma,
} from 'lucide-react';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Kpi,
  PageHeader,
  SeverityBadge,
} from '../components/ui/primitives';
import {
  useCodeAnalysis,
  useCodeIndexStatus,
  useCodePatterns,
  useCodeSymbols,
  useIndexWorkspace,
  useSearchCode,
  type CodeSearchResult,
  type CodeSymbol,
} from '../lib/queries';

const workspaceId = 'local';

export function CodeIntelligence() {
  const [query, setQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [searched, setSearched] = useState(false);

  const status = useCodeIndexStatus(workspaceId);
  const patterns = useCodePatterns(workspaceId, {
    enabled: (status.data?.indexedFiles ?? 0) > 0,
  });
  const indexWorkspace = useIndexWorkspace();
  const searchCode = useSearchCode();

  const searchResults = searchCode.data?.results ?? [];
  const symbols = useCodeSymbols(workspaceId, selectedFile, { enabled: Boolean(selectedFile) });
  const analysis = useCodeAnalysis(workspaceId, selectedFile, { enabled: Boolean(selectedFile) });

  useEffect(() => {
    if (!selectedFile && searchResults[0]) {
      setSelectedFile(searchResults[0].filePath);
    }
  }, [searchResults, selectedFile]);

  const runSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setSearched(true);
    const result = await searchCode.mutateAsync({ query: trimmed, workspaceId, limit: 40 });
    setSelectedFile(result.results[0]?.filePath ?? '');
  };

  const runIndex = async () => {
    await indexWorkspace.mutateAsync({ workspaceId });
  };

  const indexedFiles = status.data?.indexedFiles ?? 0;
  const symbolCount = symbols.data?.symbols.length ?? analysis.data?.symbols.length ?? 0;
  const totalPatterns = patterns.data?.patterns.length ?? 0;
  const selectedDependencies = analysis.data?.dependencies.length ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Code Intelligence"
        description="Workspace index, symbol map, dependency scan, and context search"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              icon={indexWorkspace.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              onClick={runIndex}
              disabled={indexWorkspace.isPending}
            >
              {indexWorkspace.isPending ? 'Indexing' : indexedFiles > 0 ? 'Re-index' : 'Index'}
            </Button>
            <Button
              variant="primary"
              icon={searchCode.isPending ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              onClick={runSearch}
              disabled={searchCode.isPending || indexedFiles === 0}
            >
              Search
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Kpi label="Indexed Files" value={String(indexedFiles)} hint={status.data?.lastIndexedAt ? 'Index ready' : 'Not indexed'} />
        <Kpi label="Search Hits" value={String(searchResults.length)} hint={searched ? query : 'Awaiting query'} />
        <Kpi label="Selected Symbols" value={String(symbolCount)} hint={selectedFile || 'No file selected'} />
        <Kpi label="Patterns" value={String(totalPatterns)} hint={`${selectedDependencies} dependencies in focus`} />
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
          <div>
            <div className="label-mono mb-1.5">Search query</div>
            <div className="flex items-center gap-2 rounded-md border border-s-border bg-s-subtle px-3 py-2">
              <Search size={14} className="text-s-muted shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') runSearch();
                }}
                className="min-w-0 flex-1 bg-transparent outline-none text-[13px] text-s-primary placeholder:text-s-muted"
                placeholder="Search symbols, services, routes, policies..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusTag state={indexWorkspace.isPending || status.data?.inProgress ? 'running' : indexedFiles > 0 ? 'ready' : 'idle'} />
            {status.data?.errors.length ? <SeverityBadge level="MEDIUM" /> : <SeverityBadge level="LOW" />}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-4">
        <SearchResults
          results={searchResults}
          selectedFile={selectedFile}
          isLoading={searchCode.isPending}
          indexedFiles={indexedFiles}
          onSelect={setSelectedFile}
          onIndex={runIndex}
        />

        <FileInspector
          filePath={selectedFile}
          symbols={symbols.data?.symbols ?? []}
          symbolLoading={symbols.isLoading}
          dependencies={analysis.data?.dependencies ?? []}
          complexity={analysis.data?.complexity ?? 0}
          patterns={patterns.data?.patterns ?? []}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DependencyPanel filePath={selectedFile} dependencies={analysis.data?.dependencies ?? []} />
        <PatternPanel patterns={patterns.data?.patterns ?? []} />
      </div>
    </div>
  );
}

function SearchResults({
  results,
  selectedFile,
  isLoading,
  indexedFiles,
  onSelect,
  onIndex,
}: {
  results: CodeSearchResult[];
  selectedFile: string;
  isLoading: boolean;
  indexedFiles: number;
  onSelect: (filePath: string) => void;
  onIndex: () => void;
}) {
  if (indexedFiles === 0) {
    return (
      <Card>
        <CardHeader title="Search results" subtitle="Index required" />
        <EmptyState
          icon={<Code2 size={18} />}
          title="Workspace not indexed"
          description="Create the first local code map before searching."
          action={<Button variant="primary" size="sm" icon={<RefreshCw size={13} />} onClick={onIndex}>Index workspace</Button>}
        />
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader title="Search results" subtitle="Scanning indexed files" />
        <EmptyState icon={<Loader2 size={18} className="animate-spin" />} title="Searching code index" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Search results" subtitle={`${results.length} ranked snippets`} />
      {results.length === 0 ? (
        <EmptyState icon={<Search size={18} />} title="No matching snippets" description="Try a symbol, route name, agent, or policy term." />
      ) : (
        <div className="divide-y divide-s-border max-h-[620px] overflow-y-auto">
          {results.map((result) => {
            const selected = selectedFile === result.filePath;
            return (
              <button
                key={`${result.filePath}:${result.line}:${result.column}`}
                onClick={() => onSelect(result.filePath)}
                className={`w-full min-w-0 text-left px-4 py-3 border-l-2 transition-colors ${
                  selected ? 'border-l-s-brand bg-s-brand/5' : 'border-l-transparent hover:bg-s-hover'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileCode2 size={14} className="text-s-brand shrink-0" />
                  <span className="truncate text-[12px] font-mono text-s-primary">{result.filePath}</span>
                  <span className="shrink-0 rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-muted">
                    L{result.line}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] font-mono text-s-muted">{result.score.toFixed(1)}</span>
                </div>
                <pre className="mt-2 overflow-hidden text-ellipsis whitespace-pre-wrap break-words rounded-md border border-s-border bg-s-base px-3 py-2 text-[11px] leading-relaxed text-s-secondary">
                  {result.snippet}
                </pre>
              </button>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function FileInspector({
  filePath,
  symbols,
  symbolLoading,
  dependencies,
  complexity,
  patterns,
}: {
  filePath: string;
  symbols: CodeSymbol[];
  symbolLoading: boolean;
  dependencies: string[];
  complexity: number;
  patterns: Array<{ name: string; confidence: number }>;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="File inspector"
        subtitle={filePath || 'No file selected'}
        action={filePath ? <SeverityBadge level={complexity > 40 ? 'MEDIUM' : 'LOW'} /> : undefined}
      />
      {!filePath ? (
        <EmptyState icon={<FileCode2 size={18} />} title="Select a result" description="Symbols and dependencies appear here." />
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <MiniMetric icon={<Sigma size={13} />} label="Complexity" value={String(complexity)} />
            <MiniMetric icon={<Braces size={13} />} label="Symbols" value={String(symbols.length)} />
            <MiniMetric icon={<GitFork size={13} />} label="Deps" value={String(dependencies.length)} />
          </div>

          <div>
            <SectionLabel>Symbols</SectionLabel>
            {symbolLoading ? (
              <div className="rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[11px] text-s-muted">Loading symbols...</div>
            ) : symbols.length === 0 ? (
              <div className="rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[11px] text-s-muted">No symbols extracted</div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {symbols.map((symbol) => (
                  <div key={symbol.id} className="rounded-md border border-s-border bg-s-base px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-[12px] font-mono text-s-primary">{symbol.name}</span>
                      <span className="shrink-0 rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono uppercase text-s-muted">
                        {symbol.type}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] font-mono text-s-muted">L{symbol.lineStart}</span>
                    </div>
                    {symbol.signature && (
                      <div className="mt-1 truncate text-[11px] font-mono text-s-secondary">{symbol.signature}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <SectionLabel>Pattern fit</SectionLabel>
            <div className="space-y-2">
              {patterns.slice(0, 3).map((pattern) => (
                <div key={pattern.name} className="flex items-center justify-between rounded-md border border-s-border bg-s-subtle px-3 py-2">
                  <span className="text-[11px] text-s-secondary">{pattern.name}</span>
                  <span className="font-mono text-[10px] text-s-muted">{Math.round(pattern.confidence * 100)}%</span>
                </div>
              ))}
              {patterns.length === 0 && (
                <div className="rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[11px] text-s-muted">
                  No pattern classification yet
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function DependencyPanel({ filePath, dependencies }: { filePath: string; dependencies: string[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Dependency scan" subtitle={filePath || 'Select a file'} action={<Network size={14} className="text-s-brand" />} />
      <div className="p-4">
        {dependencies.length === 0 ? (
          <EmptyState icon={<GitFork size={18} />} title="No dependencies found" description="Imports and includes appear after a file is selected." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {dependencies.map((dependency) => (
              <div key={dependency} className="rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[11px] font-mono text-s-secondary truncate">
                {dependency}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function PatternPanel({ patterns }: { patterns: Array<{ name: string; description: string; confidence: number; files: string[] }> }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Architecture patterns" subtitle={`${patterns.length} detected`} action={<ShieldCheck size={14} className="text-s-success" />} />
      <div className="p-4 space-y-3">
        {patterns.length === 0 ? (
          <EmptyState icon={<Network size={18} />} title="No patterns detected" description="Index the workspace to classify structure." />
        ) : (
          patterns.map((pattern) => (
            <div key={pattern.name} className="rounded-md border border-s-border bg-s-base p-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-[13px] font-medium text-s-primary">{pattern.name}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-s-muted">{Math.round(pattern.confidence * 100)}%</span>
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-s-secondary">{pattern.description}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pattern.files.slice(0, 6).map((file) => (
                  <span key={file} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[9px] font-mono text-s-muted">
                    {file}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-s-border bg-s-subtle px-3 py-2">
      <div className="flex items-center gap-1.5 text-s-muted">
        {icon}
        <span className="text-[9px] font-mono uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-1 font-mono text-lg text-s-primary">{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-s-muted">{children}</div>;
}

function StatusTag({ state }: { state: 'idle' | 'ready' | 'running' }) {
  const styles = {
    idle: 'border-s-border bg-s-subtle text-s-secondary',
    ready: 'border-s-success/30 bg-s-success/10 text-s-success',
    running: 'border-s-brand/30 bg-s-brand/10 text-s-brand',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-mono uppercase ${styles[state]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${state === 'running' ? 'bg-s-brand animate-pulse' : state === 'ready' ? 'bg-s-success' : 'bg-s-muted'}`} />
      {state}
    </span>
  );
}
