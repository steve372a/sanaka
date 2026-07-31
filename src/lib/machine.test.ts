import { describe, expect, it } from 'vitest';
import { createMachineFromTemplate } from '../domain/templates';
import { makeWorkspaceMachineItems, resolveWorkspaceSelection } from './machine';

describe('makeWorkspaceMachineItems', () => {
  it('keeps an unsaved new-machine draft out of the recent machines list', () => {
    const machine = createMachineFromTemplate('win11');

    expect(makeWorkspaceMachineItems([], { machine, dirty: true })).toEqual([]);
  });

  it('keeps a saved draft visible while it is being edited', () => {
    const machine = createMachineFromTemplate('win11');
    const items = makeWorkspaceMachineItems([], {
      machine,
      filePath: '/tmp/windows.saka',
      dirty: true
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: machine.id, path: '/tmp/windows.saka', source: 'draft' });
  });

  it('does not select an existing recent machine while creating a new one', () => {
    const machine = createMachineFromTemplate('win11');
    const items = makeWorkspaceMachineItems([
      {
        id: 'existing-machine',
        title: 'Existing Machine',
        path: '/tmp/existing.saka',
        kind: 'machine',
        updatedAt: '2026-07-29T00:00:00.000Z',
        status: 'saved'
      }
    ], { machine, dirty: true });

    expect(resolveWorkspaceSelection(items, '/machines/new', '', { machine, dirty: true }).primary).toBeNull();
  });
});
