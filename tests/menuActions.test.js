import assert from 'node:assert/strict';
import test from 'node:test';

import {findMenuActions, menuLabel} from '../src/statusNotifier/menuActions.js';

test('removes menu mnemonics without losing literal underscores', () => {
    assert.equal(menuLabel('_Show __Window'), 'Show _Window');
});

test('finds enabled app actions inside submenus', () => {
    const layout = [0, {}, [
        [1, {label: '_File', 'children-display': 'submenu'}, [
            [2, {label: '_Quit EShot'}, []],
        ]],
        [3, {label: 'Show Window'}, []],
    ]];
    assert.deepEqual(findMenuActions(layout, 'EShot'), {open: 3, close: 2});
});

test('ignores hidden, disabled, and unrelated menu actions', () => {
    const layout = [0, {}, [
        [1, {label: 'Quit', enabled: false}, []],
        [2, {label: 'Exit Fullscreen'}, []],
        [3, {label: 'Open File'}, []],
        [5, {label: 'Close Window'}, []],
        [4, {label: 'Close', visible: false}, []],
    ]];
    assert.deepEqual(findMenuActions(layout, 'EShot'), {open: null, close: null});
});

test('prefers Quit over Close when both are offered', () => {
    const layout = [0, {}, [
        [1, {label: 'Close'}, []],
        [2, {label: 'Quit'}, []],
    ]];
    assert.equal(findMenuActions(layout, 'EShot').close, 2);
});
