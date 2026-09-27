import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {findNativeMatch} from './src/appMatcher.js';
import {StatusNotifierWatcher} from './src/statusNotifier/watcher.js';
import {StatusNotifierItem} from './src/statusNotifier/item.js';
import {TrayMenu} from './src/statusNotifier/menuView.js';

export default class NativeTray extends Extension {
    enable() {
        this._attempts = 0;
        this._items = new Map();
        this._rowMenus = [];
        this._settings = this.getSettings();
        this._settingsChangedId = this._settings.connect('changed', () => this._refresh());
        this._watcher = new StatusNotifierWatcher(
            (key, owner, path) => {
                const item = new StatusNotifierItem(owner, path, () => this._refresh());
                this._items.set(key, item);
                this._refresh();
            },
            key => {
                this._items.get(key)?.destroy();
                this._items.delete(key);
                this._refresh();
            });
        this._attach();
    }

    disable() {
        this._watcher.destroy();
        this._settings.disconnect(this._settingsChangedId);
        this._settings = null;
        this._watcher = null;
        for (const item of this._items.values())
            item.destroy();
        this._items.clear();
        if (this._attachSourceId) {
            GLib.source_remove(this._attachSourceId);
            this._attachSourceId = 0;
        }

        if (!this._toggle)
            return;

        this._clearRowMenus();
        this._toggle._sync = this._originalSync;
        this._toggle._syncVisibility = this._originalSyncVisibility;
        this._toggle._sync();
        this._toggle = null;
        this._originalSync = null;
        this._originalSyncVisibility = null;
    }

    _attach() {
        const toggle = Main.panel.statusArea.quickSettings?._backgroundApps?.quickSettingsItems[0];
        if (!toggle?._appsSection || !toggle?._sync || !toggle?._syncVisibility) {
            if (++this._attempts >= 50) {
                console.warn('[NativeTray] GNOME 50 Background Apps toggle was not found');
                return;
            }

            this._attachSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
                this._attach();
                return GLib.SOURCE_REMOVE;
            });
            return;
        }

        this._attachSourceId = 0;
        this._toggle = toggle;
        this._originalSync = toggle._sync;
        this._originalSyncVisibility = toggle._syncVisibility;

        toggle._sync = (...args) => {
            this._clearRowMenus();
            this._originalSync.apply(toggle, args);
            this._addSniRows();
            toggle._syncVisibility();
        };
        toggle._syncVisibility = (...args) => {
            this._originalSyncVisibility.apply(toggle, args);
            if (!Main.sessionMode.isLocked && this._settings.get_boolean('show-sni-items') && this._items.size > 0)
                toggle.visible = true;
        };

        toggle._sync();
        console.debug('[NativeTray] Background Apps integration attached');
    }

    _refresh() {
        this._toggle?._sync();
    }

    _addSniRows() {
        const section = this._toggle._appsSection;
        const nativeApps = section._getMenuItems()
            .map(row => row.app)
            .filter(Boolean);

        const enhancedNativeRows = new Set();
        if (!this._settings.get_boolean('show-sni-items'))
            return;
        for (const item of this._items.values()) {
            if (!item.proxy || item.status === 'Passive')
                continue;
            const native = this._settings.get_boolean('merge-duplicates')
                ? findNativeMatch(nativeApps, item) : null;
            const row = native
                ? section._getMenuItems().find(candidate => candidate.app === native)
                : new PopupMenu.PopupImageMenuItem(item.title, item.icon);
            if (!row)
                continue;
            if (native && enhancedNativeRows.has(row))
                continue;
            if (!native) {
                row.add_style_class_name('background-app-item');
                row.label.add_style_class_name('title');
                section.addMenuItem(row);
            }
            const menu = new TrayMenu(row, item, section, this._settings);
            this._rowMenus.push(menu);
            if (native)
                enhancedNativeRows.add(row);
            const originalActivate = row.activate.bind(row);
            row.activate = event => menu.activate(() => {
                if (native) {
                    originalActivate(event);
                } else {
                    Main.overview.hide();
                    Main.panel.closeQuickSettings();
                    item.activate(() => item.app?.activate());
                }
            });
        }

        const count = section.numMenuItems;
        this._toggle.title = count === 0
            ? _('No Background Apps')
            : ngettext('%d Background App', '%d Background Apps', count).format(count);
        this._toggle._listTitle.visible = count > 0;
    }

    _clearRowMenus() {
        for (const menu of this._rowMenus)
            menu.destroy();
        this._rowMenus = [];
    }
}
