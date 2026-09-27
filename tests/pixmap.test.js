import assert from 'node:assert/strict';
import {test} from 'node:test';

import {argbToRgba, selectPixmap} from '../src/statusNotifier/pixmap.js';

test('converts network-order ARGB bytes into RGBA', () => {
    assert.deepEqual([...argbToRgba(Uint8Array.of(128, 1, 2, 3))], [1, 2, 3, 128]);
});

test('chooses a valid icon near the target size', () => {
    const small = [16, 16, new Uint8Array(16 * 16 * 4)];
    const close = [24, 24, new Uint8Array(24 * 24 * 4)];
    const invalid = [512, 512, new Uint8Array(512 * 512 * 4)];
    assert.equal(selectPixmap([small, close, invalid]), close);
    assert.equal(selectPixmap([[8, 8, new Uint8Array(3)]]), null);
});
