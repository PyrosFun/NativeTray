import assert from 'node:assert/strict';
import {test} from 'node:test';

import {findNativeMatch} from '../src/appMatcher.js';

function app(id, name, pids = []) {
    return {
        get_id: () => id,
        get_name: () => name,
        get_pids: () => pids,
    };
}

test('matches exact desktop IDs', () => {
    const native = app('org.example.Sync.desktop', 'Sync');
    assert.equal(findNativeMatch([native], {id: 'org.example.Sync', title: 'Other'}), native);
});

test('matches a running app by PID', () => {
    const native = app('org.example.Sync.desktop', 'Sync', [42]);
    assert.equal(findNativeMatch([native], {id: 'unknown', title: 'Other', pid: 42}), native);
});

test('merges a uniquely identified client name', () => {
    const native = app('com.example.Seafile.desktop', 'Seafile');
    assert.equal(findNativeMatch([native], {id: 'seafile-client', title: 'Seafile Client'}), native);
});

test('does not merge unrelated or ambiguous names', () => {
    const native = app('com.example.Seafile.desktop', 'Seafile');
    assert.equal(findNativeMatch([native], {id: 'sync-client', title: 'Seafile Client'}), null);
    assert.equal(findNativeMatch([native, app('other.desktop', 'Seafile')],
        {id: 'seafile-client', title: 'Seafile Client'}), null);
});
