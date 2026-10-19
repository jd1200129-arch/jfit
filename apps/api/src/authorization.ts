export const staffRoles = ['administrator', 'content_manager', 'trainer', 'commerce', 'support', 'finance'] as const;
export type StaffRole = typeof staffRoles[number];

export const staffPermissions = [
  'staff:read-self',
  'staff:manage-roles',
  'audit:read',
  'settings:manage',
  'catalog:read',
  'catalog:write',
  'inventory:read',
  'inventory:write',
  'orders:read',
  'orders:write',
  'orders:read-support-status',
  'fulfillment:manage',
  'returns:read',
  'returns:manage',
  'refunds:request',
  'refunds:review',
  'content:read',
  'content:write',
  'content:publish',
  'content:read-assigned',
  'content:write-assigned',
  'support:read-assigned',
  'support:manage-assigned',
  'reports:commerce',
  'finance:reconcile',
  'jobs:manage',
  'integrations:manage',
] as const;
export type StaffPermission = typeof staffPermissions[number];

const permissionsByRole: Readonly<Record<StaffRole, readonly StaffPermission[]>> = {
  administrator: [
    'staff:read-self', 'staff:manage-roles', 'audit:read', 'settings:manage',
    'catalog:read', 'catalog:write', 'inventory:read', 'inventory:write',
    'orders:read', 'orders:write', 'fulfillment:manage', 'returns:read', 'returns:manage',
    'refunds:request', 'refunds:review', 'content:read', 'content:write', 'content:publish',
    'support:read-assigned', 'support:manage-assigned', 'reports:commerce', 'finance:reconcile',
    'jobs:manage', 'integrations:manage',
  ],
  content_manager: ['staff:read-self', 'content:read', 'content:write', 'content:publish'],
  trainer: ['staff:read-self', 'content:read-assigned', 'content:write-assigned'],
  commerce: [
    'staff:read-self', 'catalog:read', 'catalog:write', 'inventory:read', 'inventory:write',
    'orders:read', 'orders:write', 'fulfillment:manage', 'returns:read', 'returns:manage',
    'refunds:request', 'reports:commerce',
  ],
  support: ['staff:read-self', 'orders:read-support-status', 'support:read-assigned', 'support:manage-assigned'],
  finance: ['staff:read-self', 'orders:read', 'refunds:review', 'finance:reconcile'],
};

export function isStaffRole(value: string): value is StaffRole {
  return (staffRoles as readonly string[]).includes(value);
}

export function hasStaffPermission(role: StaffRole, permission: StaffPermission): boolean {
  return permissionsByRole[role].includes(permission);
}

export function permissionsForRole(role: StaffRole): readonly StaffPermission[] {
  return permissionsByRole[role];
}

type Query = (sql: string, values: [string]) => Promise<{ rows: Array<{ role: string }> }>;

/** Load the server-assigned role. Unknown, deleted, or absent staff identities fail closed. */
export async function staffRoleForUser(query: Query, userId: string): Promise<StaffRole | null> {
  const result = await query(
    `SELECT sm.role FROM staff_memberships sm
       JOIN users u ON u.id=sm.user_id
      WHERE sm.user_id=$1 AND u.deleted_at IS NULL`,
    [userId],
  );
  const role = result.rows[0]?.role;
  return role && isStaffRole(role) ? role : null;
}
