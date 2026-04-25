import { useEffect, useMemo, useState } from "react";
import { KeyRound, Plus, RefreshCw, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Card, CardHeader, PageHeader, Button, SeverityBadge } from "../components/ui/primitives";
import { useTheme } from "../lib/store";
import {
  useModelProviderConfig,
  useDeleteSkill,
  useModelRuntimeStatus,
  useSaveModelProviderConfig,
  useSaveWorkspaceSettings,
  useSaveSkill,
  useSetSkillEnabled,
  useSkills,
  useWorkspaceSettings,
  type ConfigurableProvider,
  type ProviderConfigInput,
  type SkillPack,
  type WorkspaceSettings,
} from "../lib/queries";
import { useToast } from "../lib/toast";

const sections = ["General", "Appearance", "Security", "Provider Keys", "Skills", "Notifications"] as const;

const providerLabels: Record<ConfigurableProvider, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google Gemini",
  bedrock: "AWS Bedrock",
  ollama: "Ollama",
  vllm: "vLLM",
};

export function Settings() {
  const [section, setSection] = useState<(typeof sections)[number]>("Provider Keys");
  const { theme, toggle } = useTheme();
  const settings = useWorkspaceSettings();
  const saveSettings = useSaveWorkspaceSettings();

  return (
    <div>
      <PageHeader title="Settings" description="Workspace, provider keys, skills, security, and integration controls" />

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        <aside className="flex md:flex-col gap-0.5 overflow-x-auto md:overflow-x-visible">
          {sections.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`text-left px-3 py-2 rounded-md text-[13px] shrink-0 ${
                section === s ? "bg-s-brand/10 text-s-brand" : "text-s-secondary hover:bg-s-hover hover:text-s-primary"
              }`}
            >
              {s}
            </button>
          ))}
        </aside>

        <div className="flex flex-col gap-4 min-w-0">
          {section === "General" && (
            <GeneralSettingsPanel
              settings={settings.data ?? null}
              isLoading={settings.isLoading}
              isSaving={saveSettings.isPending}
              onSave={(workspace) => saveSettings.mutateAsync({ workspace })}
            />
          )}

          {section === "Appearance" && (
            <Card className="overflow-hidden">
              <CardHeader title="Appearance" subtitle="Theme and density" />
              <div className="p-5">
                <div className="flex items-center justify-between py-2.5 border-b border-s-border">
                  <div>
                    <div className="text-s-primary text-[13px] font-medium">Theme</div>
                    <div className="text-s-secondary text-xs">Choose between dark and light mode</div>
                  </div>
                  <div className="flex gap-1 p-0.5 rounded-md bg-s-subtle border border-s-border">
                    {(["dark", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => { if (t !== theme) toggle(); }}
                        className={`px-3 py-1 rounded text-xs capitalize ${theme === t ? "bg-s-surface text-s-primary" : "text-s-secondary"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          {section === "Security" && (
            <SecuritySettingsPanel
              settings={settings.data ?? null}
              isLoading={settings.isLoading}
              isSaving={saveSettings.isPending}
              onPatch={(security) => saveSettings.mutateAsync({ security })}
            />
          )}

          {section === "Provider Keys" && <ProviderKeysPanel />}

          {section === "Skills" && <SkillsPanel />}

          {section === "Notifications" && (
            <NotificationSettingsPanel
              settings={settings.data ?? null}
              isLoading={settings.isLoading}
              isSaving={saveSettings.isPending}
              onPatch={(notifications) => saveSettings.mutateAsync({ notifications })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function GeneralSettingsPanel({
  settings,
  isLoading,
  isSaving,
  onSave,
}: {
  settings: WorkspaceSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  onSave: (workspace: Partial<WorkspaceSettings["workspace"]>) => Promise<WorkspaceSettings>;
}) {
  const { toast } = useToast();
  const [workspace, setWorkspace] = useState<WorkspaceSettings["workspace"]>({
    name: "",
    tenantId: "",
    region: "",
    timezone: "",
  });

  useEffect(() => {
    if (settings) setWorkspace(settings.workspace);
  }, [settings]);

  const update = (key: keyof WorkspaceSettings["workspace"], value: string) => {
    setWorkspace((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    await onSave(workspace);
    toast({ kind: "success", title: "Workspace saved", description: "Settings were persisted through the backend API." });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Workspace" subtitle={settings ? `Backend connected. Updated ${new Date(settings.updatedAt).toLocaleString()}` : "Loading backend settings"} />
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Workspace Name" value={workspace.name} onChange={(value) => update("name", value)} placeholder={isLoading ? "Loading..." : "AXON Workspace"} />
          <Input label="Tenant ID" value={workspace.tenantId} onChange={(value) => update("tenantId", value)} placeholder="tenant_default" />
          <Input label="Region" value={workspace.region} onChange={(value) => update("region", value)} placeholder="ap-south-1" />
          <Input label="Timezone" value={workspace.timezone} onChange={(value) => update("timezone", value)} placeholder="Asia/Kolkata" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-s-border bg-s-base p-3">
          <div className="text-[12px] text-s-secondary">
            Source: <span className="font-mono text-s-primary">GET/PATCH /api/v1/settings</span>
          </div>
          <Button variant="primary" size="sm" icon={<Save size={13} />} disabled={isSaving || !workspace.name.trim()} onClick={save}>
            Save workspace
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SecuritySettingsPanel({
  settings,
  isLoading,
  isSaving,
  onPatch,
}: {
  settings: WorkspaceSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  onPatch: (security: Partial<WorkspaceSettings["security"]>) => Promise<WorkspaceSettings>;
}) {
  const { toast } = useToast();
  const security = settings?.security;
  const runtime = settings?.runtime;

  const patch = async (key: keyof WorkspaceSettings["security"], value: boolean) => {
    await onPatch({ [key]: value });
    toast({ kind: "success", title: "Security setting saved", description: "The backend settings store was updated." });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Security"
        subtitle={runtime?.backendConnected ? "Live backend settings, key storage, and audit controls" : "Loading backend security settings"}
        action={<SeverityBadge level={runtime?.providerSecretMode === "encrypted" ? "LOW" : "MEDIUM"} />}
      />
      <div className="p-5 flex flex-col gap-3">
        <Toggle
          title="Require SSO"
          description={runtime?.ssoConfigured ? "OIDC/SAML issuer is configured for operator login" : "Set AXON_SSO_ISSUER_URL or OIDC_ISSUER_URL before enforcing external SSO"}
          checked={Boolean(security?.requireSso)}
          disabled={isLoading || isSaving}
          onChange={(value) => patch("requireSso", value)}
          badge={runtime?.ssoConfigured ? "configured" : "needs env"}
        />
        <Toggle
          title="Two-factor authentication"
          description="Required for approval and production actions"
          checked={Boolean(security?.twoFactorAuth)}
          disabled={isLoading || isSaving}
          onChange={(value) => patch("twoFactorAuth", value)}
        />
        <Toggle
          title="Tamper-evident audit log"
          description={runtime?.auditSigningConfigured ? "Ledger signing key is configured" : "Hash-chain is active; set AXON_LEDGER_SIGNING_KEY for signed external evidence"}
          checked={Boolean(security?.tamperEvidentAuditLog)}
          disabled={isLoading || isSaving}
          onChange={(value) => patch("tamperEvidentAuditLog", value)}
          badge={runtime?.kmsSigningConfigured ? "KMS" : runtime?.auditSigningConfigured ? "signed" : "local"}
        />
        <Toggle
          title="Encrypted provider storage"
          description={runtime?.providerSecretMode === "encrypted" ? "Provider secrets are encrypted with AXON_CONFIG_SECRET" : "Set AXON_CONFIG_SECRET for AES-GCM provider credential encryption"}
          checked={Boolean(security?.encryptedProviderStorage)}
          disabled={isLoading || isSaving}
          onChange={(value) => patch("encryptedProviderStorage", value)}
          badge={runtime?.providerSecretMode}
        />
      </div>
    </Card>
  );
}

function NotificationSettingsPanel({
  settings,
  isLoading,
  isSaving,
  onPatch,
}: {
  settings: WorkspaceSettings | null;
  isLoading: boolean;
  isSaving: boolean;
  onPatch: (notifications: Partial<WorkspaceSettings["notifications"]>) => Promise<WorkspaceSettings>;
}) {
  const { toast } = useToast();
  const notifications = settings?.notifications;

  const patch = async (key: keyof WorkspaceSettings["notifications"], value: boolean) => {
    await onPatch({ [key]: value });
    toast({ kind: "success", title: "Notification setting saved", description: "The backend settings store was updated." });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Notifications" subtitle="Backend-backed alert and approval delivery preferences" />
      <div className="p-5 flex flex-col gap-3">
        <Toggle
          title="Email digests"
          description="Daily summary at 09:00 workspace time"
          checked={Boolean(notifications?.emailDigests)}
          disabled={isLoading || isSaving}
          onChange={(value) => patch("emailDigests", value)}
        />
        <Toggle
          title="Slack alerts"
          description="P0/P1 incidents and approval blockers"
          checked={Boolean(notifications?.slackAlerts)}
          disabled={isLoading || isSaving}
          onChange={(value) => patch("slackAlerts", value)}
        />
        <Toggle
          title="Push to mobile"
          description="Approval requests and acknowledged alerts"
          checked={Boolean(notifications?.pushToMobile)}
          disabled={isLoading || isSaving}
          onChange={(value) => patch("pushToMobile", value)}
        />
      </div>
    </Card>
  );
}

function ProviderKeysPanel() {
  const { data: config } = useModelProviderConfig();
  const { data: runtime, refetch, isFetching } = useModelRuntimeStatus();
  const saveProvider = useSaveModelProviderConfig();
  const { toast } = useToast();
  const liveProviders = new Set(runtime?.providers ?? []);

  const handleSave = async (input: ProviderConfigInput) => {
    await saveProvider.mutateAsync(input);
    toast({ kind: "success", title: "Provider saved", description: `${providerLabels[input.provider]} is now available to the router.` });
    await refetch();
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader
          title="Model provider keys"
          subtitle="Connect Anthropic, OpenAI, Bedrock, local runtimes, and private endpoints from the web UI"
          action={<Button variant="secondary" size="sm" icon={<RefreshCw size={13} className={isFetching ? "animate-spin" : ""} />} onClick={() => refetch()}>Test health</Button>}
        />
        <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {(["anthropic", "openai", "bedrock", "google", "ollama", "vllm"] as ConfigurableProvider[]).map((provider) => (
            <ProviderCard
              key={provider}
              provider={provider}
              live={liveProviders.has(provider)}
              masked={config?.providers.find((item) => item.provider === provider)}
              onSave={handleSave}
              isSaving={saveProvider.isPending}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function ProviderCard({
  provider,
  live,
  masked,
  onSave,
  isSaving,
}: {
  provider: ConfigurableProvider;
  live: boolean;
  masked?: {
    apiKeyMasked?: string;
    accessKeyIdMasked?: string;
    secretAccessKeyMasked?: string;
    sessionTokenMasked?: string;
    baseUrl?: string;
    region?: string;
    secretMode: "encrypted" | "local-obfuscated";
  };
  onSave: (input: ProviderConfigInput) => Promise<void>;
  isSaving: boolean;
}) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(masked?.baseUrl ?? defaultBaseUrl(provider));
  const [region, setRegion] = useState(masked?.region ?? "ap-south-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [sessionToken, setSessionToken] = useState("");

  useEffect(() => {
    setBaseUrl(masked?.baseUrl ?? defaultBaseUrl(provider));
    setRegion(masked?.region ?? "ap-south-1");
  }, [masked?.baseUrl, masked?.region, provider]);

  const isBedrock = provider === "bedrock";
  const needsBaseUrl = provider === "ollama" || provider === "vllm";
  const canSave = isBedrock
    ? Boolean(region && (accessKeyId || masked?.accessKeyIdMasked) && (secretAccessKey || masked?.secretAccessKeyMasked))
    : needsBaseUrl
      ? Boolean(baseUrl)
      : Boolean(apiKey || masked?.apiKeyMasked);

  return (
    <div className="rounded-lg border border-s-border bg-s-base p-4 min-w-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <KeyRound size={14} className="text-s-brand" />
            <div className="text-[13px] font-medium text-s-primary">{providerLabels[provider]}</div>
          </div>
          <div className="mt-1 text-[11px] text-s-secondary">
            {live ? "Connected to router" : masked ? "Saved, awaiting health check" : "Not configured"}
          </div>
        </div>
        <span className={`rounded border px-2 py-1 text-[10px] font-mono uppercase ${live ? "border-s-success/30 bg-s-success/10 text-s-success" : "border-s-warning/30 bg-s-warning/10 text-s-warning"}`}>
          {live ? "live" : "setup"}
        </span>
      </div>

      <div className="space-y-3">
        {isBedrock ? (
          <>
            <Input label="AWS Region" value={region} onChange={setRegion} placeholder="ap-south-1" />
            <Input label="Access Key ID" value={accessKeyId} onChange={setAccessKeyId} placeholder={masked?.accessKeyIdMasked ?? "AKIA..."} />
            <Input label="Secret Access Key" type="password" value={secretAccessKey} onChange={setSecretAccessKey} placeholder={masked?.secretAccessKeyMasked ?? "secret"} />
            <Input label="Session Token" type="password" value={sessionToken} onChange={setSessionToken} placeholder={masked?.sessionTokenMasked ?? "optional"} />
          </>
        ) : (
          <>
            {!needsBaseUrl && <Input label="API Key" type="password" value={apiKey} onChange={setApiKey} placeholder={masked?.apiKeyMasked ?? "paste key"} />}
            <Input label={needsBaseUrl ? "Base URL" : "Base URL optional"} value={baseUrl} onChange={setBaseUrl} placeholder={defaultBaseUrl(provider)} />
          </>
        )}

        {masked && (
          <div className="rounded-md border border-s-border bg-s-subtle p-2 text-[11px] text-s-secondary">
            Stored mode: <span className="font-mono text-s-primary">{masked.secretMode}</span>
          </div>
        )}

        <Button
          variant="primary"
          size="sm"
          icon={<Save size={13} />}
          disabled={!canSave || isSaving}
          onClick={() => onSave({
            provider,
            enabled: true,
            apiKey: apiKey || undefined,
            baseUrl: baseUrl || undefined,
            region: isBedrock ? region : undefined,
            accessKeyId: accessKeyId || undefined,
            secretAccessKey: secretAccessKey || undefined,
            sessionToken: sessionToken || undefined,
          })}
        >
          Save provider
        </Button>
      </div>
    </div>
  );
}

function SkillsPanel() {
  const { data } = useSkills();
  const saveSkill = useSaveSkill();
  const setEnabled = useSetSkillEnabled();
  const deleteSkill = useDeleteSkill();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [prompts, setPrompts] = useState("");
  const [tools, setTools] = useState("");

  const skills = data?.skills ?? [];
  const enabledCount = useMemo(() => skills.filter((skill) => skill.enabled).length, [skills]);

  const handleCreate = async () => {
    await saveSkill.mutateAsync({
      name,
      description,
      capabilities: parseList(capabilities),
      prompts: parseList(prompts),
      allowedTools: parseList(tools),
      riskLevel: "medium",
      enabled: true,
    });
    toast({ kind: "success", title: "Skill saved", description: "The custom capability pack is now available in AXON." });
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <CardHeader title="Skill and capability packs" subtitle="Create operator-defined abilities, prompts, tool scopes, and risk labels" action={<SeverityBadge level="P1" />} />
        <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-4 p-4">
          <div className="space-y-3">
            <Input label="Skill name" value={name} onChange={setName} placeholder="Capability pack name" />
            <Input label="Description" value={description} onChange={setDescription} placeholder="What this skill helps agents do" />
            <Input label="Capabilities" value={capabilities} onChange={setCapabilities} placeholder="review, architecture-check, test-plan" />
            <Input label="Prompts" value={prompts} onChange={setPrompts} placeholder="Comma-separated operating instructions" />
            <Input label="Allowed tools" value={tools} onChange={setTools} placeholder="code.search, git.diff, shell.test" />
            <Button variant="primary" size="sm" icon={<Plus size={13} />} disabled={saveSkill.isPending || !name.trim()} onClick={handleCreate}>
              Add skill
            </Button>
          </div>
          <div className="rounded-md border border-s-border bg-s-base p-3 min-w-0">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-medium text-s-primary">Installed packs</div>
                <div className="text-[11px] text-s-secondary">{enabledCount}/{skills.length} enabled</div>
              </div>
              <Sparkles size={16} className="text-s-warning" />
            </div>
            <div className="space-y-2">
              {skills.map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  onToggle={(enabled) => setEnabled.mutate({ id: skill.id, enabled })}
                  onDelete={() => deleteSkill.mutate(skill.id)}
                  canDelete={skill.owner !== "platform"}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SkillRow({ skill, onToggle, onDelete, canDelete }: { skill: SkillPack; onToggle: (enabled: boolean) => void; onDelete: () => void; canDelete: boolean }) {
  return (
    <div className="rounded-md border border-s-border bg-s-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className={skill.enabled ? "text-s-success" : "text-s-muted"} />
            <div className="text-[12px] font-medium text-s-primary truncate">{skill.name}</div>
          </div>
          <div className="mt-1 text-[11px] leading-relaxed text-s-secondary">{skill.description}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skill.capabilities.slice(0, 4).map((capability) => (
              <span key={capability} className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono text-s-secondary">
                {capability}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canDelete && (
            <button onClick={onDelete} className="rounded border border-s-border p-1.5 text-s-muted hover:text-s-critical" aria-label={`Delete ${skill.name}`}>
              <Trash2 size={12} />
            </button>
          )}
          <button
            onClick={() => onToggle(!skill.enabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${skill.enabled ? "bg-s-brand" : "bg-s-subtle border border-s-border"}`}
            aria-label={`Toggle ${skill.name}`}
          >
            <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${skill.enabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="label-mono mb-1.5 block">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-s-border bg-s-subtle px-3 py-2 text-[13px] text-s-primary outline-none transition-colors placeholder:text-s-muted focus:border-s-brand/50"
      />
    </label>
  );
}

function Toggle({
  title,
  description,
  checked,
  disabled,
  onChange,
  badge,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-s-border last:border-0">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-s-primary text-[13px] font-medium">
          {title}
          {badge && <span className="rounded border border-s-border bg-s-subtle px-1.5 py-0.5 text-[10px] font-mono uppercase text-s-secondary">{badge}</span>}
        </div>
        <div className="text-s-secondary text-xs">{description}</div>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        disabled={disabled}
        aria-pressed={checked}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "bg-s-brand" : "bg-s-subtle border border-s-border"}`}
      >
        <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function defaultBaseUrl(provider: ConfigurableProvider): string {
  if (provider === "anthropic") return "https://api.anthropic.com/v1";
  if (provider === "openai") return "https://api.openai.com/v1";
  if (provider === "google") return "https://generativelanguage.googleapis.com/v1beta";
  if (provider === "ollama") return "http://localhost:11434";
  if (provider === "vllm") return "http://localhost:8000/v1";
  return "";
}

function parseList(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}
