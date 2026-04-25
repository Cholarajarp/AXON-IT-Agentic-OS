export type Role = 'admin' | 'operator' | 'viewer' | 'auditor' | 'agent';

export interface Permission {
  resource: string;
  actions: ('create' | 'read' | 'update' | 'delete' | 'execute' | 'approve')[];
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  tenantId: string;
  permissions: Permission[];
  active: boolean;
  lastLogin?: number;
}

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    { resource: '*', actions: ['create', 'read', 'update', 'delete', 'execute', 'approve'] },
  ],
  operator: [
    { resource: 'workflows', actions: ['create', 'read', 'update', 'execute'] },
    { resource: 'agents', actions: ['read', 'execute'] },
    { resource: 'approvals', actions: ['read', 'approve'] },
    { resource: 'tools', actions: ['read', 'execute'] },
    { resource: 'incidents', actions: ['create', 'read', 'update'] },
    { resource: 'alerts', actions: ['read', 'update'] },
    { resource: 'integrations', actions: ['read'] },
    { resource: 'cost', actions: ['read'] },
    { resource: 'memory', actions: ['read'] },
  ],
  viewer: [
    { resource: 'workflows', actions: ['read'] },
    { resource: 'agents', actions: ['read'] },
    { resource: 'incidents', actions: ['read'] },
    { resource: 'alerts', actions: ['read'] },
    { resource: 'cost', actions: ['read'] },
    { resource: 'executive', actions: ['read'] },
    { resource: 'policies', actions: ['read'] },
  ],
  auditor: [
    { resource: 'audit', actions: ['read'] },
    { resource: 'evidence', actions: ['read'] },
    { resource: 'policies', actions: ['read'] },
    { resource: 'workflows', actions: ['read'] },
    { resource: 'cost', actions: ['read'] },
    { resource: 'incidents', actions: ['read'] },
    { resource: 'integrations', actions: ['read'] },
  ],
  agent: [
    { resource: 'workflows', actions: ['read', 'update'] },
    { resource: 'tools', actions: ['execute'] },
    { resource: 'memory', actions: ['read', 'create'] },
    { resource: 'cost', actions: ['create'] },
  ],
};

class RBACService {
  private users = new Map<string, TenantUser>();

  getPermissionsForRole(role: Role): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  canAccess(user: TenantUser, resource: string, action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve'): boolean {
    if (!user.active) return false;

    const permissions = [...this.getPermissionsForRole(user.role), ...user.permissions];
    for (const perm of permissions) {
      if (perm.resource === '*' || perm.resource === resource) {
        if (perm.actions.includes(action)) return true;
      }
    }
    return false;
  }

  registerUser(user: TenantUser) {
    this.users.set(user.id, user);
  }

  getUser(id: string): TenantUser | undefined {
    return this.users.get(id);
  }

  getUsersByTenant(tenantId: string): TenantUser[] {
    return Array.from(this.users.values()).filter((u) => u.tenantId === tenantId);
  }

  listRoles(): Array<{ role: Role; permissions: Permission[] }> {
    return Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role: role as Role,
      permissions,
    }));
  }

  createTenantUser(params: { email: string; name: string; role: Role; tenantId: string }): TenantUser {
    const user: TenantUser = {
      id: `usr_${Date.now().toString(36)}`,
      email: params.email,
      name: params.name,
      role: params.role,
      tenantId: params.tenantId,
      permissions: [],
      active: true,
    };
    this.users.set(user.id, user);
    return user;
  }
}

export const rbacService = new RBACService();
