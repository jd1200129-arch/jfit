import assert from 'node:assert/strict';
import test from 'node:test';
import { hasStaffPermission, staffRoleForUser } from '../src/authorization.js';

test('staff role boundaries keep content, commerce, support, and finance separate', () => {
  assert.equal(hasStaffPermission('trainer', 'content:write-assigned'), true);
  assert.equal(hasStaffPermission('trainer', 'content:publish'), false);
  assert.equal(hasStaffPermission('trainer', 'orders:read'), false);

  assert.equal(hasStaffPermission('support', 'orders:read-support-status'), true);
  assert.equal(hasStaffPermission('support', 'orders:read'), false);
  assert.equal(hasStaffPermission('support', 'refunds:request'), false);

  assert.equal(hasStaffPermission('finance', 'refunds:review'), true);
  assert.equal(hasStaffPermission('finance', 'refunds:request'), false);
  assert.equal(hasStaffPermission('finance', 'inventory:write'), false);

  assert.equal(hasStaffPermission('commerce', 'inventory:write'), true);
  assert.equal(hasStaffPermission('commerce', 'staff:manage-roles'), false);
});

test('staff role lookup is server sourced and fails closed for absent or unknown roles', async () => {
  const query = async (_sql: string, _values: [string]) => ({ rows: [{ role: 'support' }] });
  assert.equal(await staffRoleForUser(query, 'user-id'), 'support');

  const absent = async (_sql: string, _values: [string]) => ({ rows: [] });
  assert.equal(await staffRoleForUser(absent, 'user-id'), null);

  const unknown = async (_sql: string, _values: [string]) => ({ rows: [{ role: 'owner' }] });
  assert.equal(await staffRoleForUser(unknown, 'user-id'), null);
});
