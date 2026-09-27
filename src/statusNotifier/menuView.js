import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {DBusMenu} from './dbusMenu.js';
import {findMenuActions, menuLabel} from './menuActions.js';

let openRoot = null;

// Shell tracks one top-level submenu; deeper menus must not close their ancestors.
const NestedSubMenuItem = GObject.registerClass(
class NestedSubMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _subMenuOpenStateChanged(_menu, open) {
        if (open) {
            this.add_style_pseudo_class('open');
            this.add_style_pseudo_class('checked');
            this.add_accessible_state(Atk.StateType.EXPANDED);
        } else {
            this.remove_style_pseudo_class('open');
            this.remove_style_pseudo_class('checked');
            this.remove_accessible_state(Atk.StateType.EXPANDED);
        }
    }
});

export class TrayMenu {
    constructor(row, item, section, settings) {
        this._row = row;
        this._item = item;
        this._settings = settings;
        this._destroyed = false;
        this._generation = 0;
        this._inspectionGeneration = 0;
        this._actions = {open: null, close: null};
        this._dbusMenu = item.menuPath
            ? new DBusMenu(item.owner, item.menuPath) : null;
        if (row.app) {
            const nativeClose = row.get_last_child();
            row.remove_child(nativeClose);
            nativeClose.destroy();
        } else {
            row.label.x_expand = true;
        }
        if (this._dbusMenu) {
            this._arrow = new St.Button({
                iconName: 'pan-end-symbolic',
                styleClass: 'icon-button',
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.CENTER,
                can_focus: true,
            });
            row.add_child(this._arrow);
            this._arrowIcon = this._arrow.get_child();
            this._arrowIcon.pivot_point = new Graphene.Point({x: 0.5, y: 0.6});
            this._menu = new PopupMenu.PopupSubMenu(row, this._arrowIcon);
            this._menu.actor.add_style_class_name('nativetray-submenu');
            this._menu._setParent(section);
            section.box.insert_child_above(this._menu.actor, row);
            this._menu.connect('open-state-changed', (_menu, open) => {
                if (open) {
                    openRoot?.close(false);
                    openRoot = this._menu;
                    row.add_style_pseudo_class('checked');
                } else {
                    if (openRoot === this._menu)
                        openRoot = null;
                    row.remove_style_pseudo_class('checked');
                }
            });
            this._arrow.connect('clicked', () => this.toggle());
            this._dbusMenu.setChanged(() => {
                if (this._menu.isOpen)
                    this._load();
                else
                    this._inspectActions();
            });
        }
        this._closeButton = new St.Button({
            iconName: 'window-close-symbolic',
            styleClass: 'icon-button',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.CENTER,
            can_focus: true,
        });
        row.add_child(this._closeButton);
        this._closeButton.connect('clicked', () => this._close());
        this._syncCloseButton();
        if (this._dbusMenu)
            this._inspectActions();

        this._section = section;
        this._closedId = section.connect('menu-closed', () =>
            this._menu?.close(false));
        row.connect('button-press-event', (_actor, event) => {
            if (event.get_button() === 3) {
                this.open(event);
                return Clutter.EVENT_STOP;
            }
            if (event.get_button() === 2 && settings.get_boolean('middle-click-activates')) {
                item.secondaryActivate();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
        row.connect('popup-menu', () => this.open());
    }

    activate(fallback) {
        if (this._item.isMenu || this._settings.get_string('left-click-action') === 'menu') {
            this.open();
            return;
        }
        if (this._dbusMenu && this._actions.open !== null) {
            Main.overview.hide();
            Main.panel.closeQuickSettings();
            this._dbusMenu.event(this._actions.open);
            return;
        }
        fallback();
    }

    _close() {
        if (this._dbusMenu && this._actions.close !== null) {
            this._dbusMenu.event(this._actions.close);
        } else if (this._row.app) {
            this._row._quitApp().catch(error =>
                console.warn('[NativeTray] Failed to close app: ' + error.message));
        }
    }

    _syncCloseButton() {
        const available = !!this._row.app || this._actions.close !== null;
        this._closeButton.reactive = available;
        this._closeButton.can_focus = available;
        if (available)
            this._closeButton.remove_style_pseudo_class('insensitive');
        else
            this._closeButton.add_style_pseudo_class('insensitive');
    }

    async _inspectActions() {
        const generation = ++this._inspectionGeneration;
        try {
            const layout = await this._dbusMenu.layout(0, false);
            if (this._destroyed || generation !== this._inspectionGeneration)
                return;
            this._actions = findMenuActions(layout, this._item.title);
            this._syncCloseButton();
        } catch (error) {
            if (!this._destroyed)
                console.warn('[NativeTray] Tray actions unavailable: ' + error.message);
        }
    }

    open(event = null) {
        if (!this._dbusMenu) {
            const [x, y] = event?.get_coords() || [0, 0];
            this._item.contextMenu(Math.trunc(x), Math.trunc(y));
            return;
        }
        if (this._menu.isOpen) {
            this._menu.close(false);
            return;
        }
        this._load();
    }

    toggle() {
        this.open();
    }

    async _load() {
        const generation = ++this._generation;
        try {
            const layout = await this._dbusMenu.layout();
            if (this._destroyed || generation !== this._generation)
                return;
            this._inspectionGeneration++;
            this._actions = findMenuActions(layout, this._item.title);
            this._syncCloseButton();
            this._render(this._menu, layout[2], 0);
            if (!this._menu.isEmpty() && !this._menu.isOpen)
                this._menu.open(false);
        } catch (error) {
            if (!this._destroyed)
                console.warn('[NativeTray] Tray menu unavailable: ' + error.message);
        }
    }

    _render(menu, children, depth) {
        menu.removeAll();
        if (depth > 5 || !Array.isArray(children))
            return;
        for (const child of children.slice(0, 200)) {
            const [id, properties, descendants] = child;
            if (!properties || properties.visible === false)
                continue;
            if (properties.type === 'separator') {
                menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                continue;
            }
            const text = menuLabel(properties.label);
            if (!text)
                continue;
            const nested = properties['children-display'] === 'submenu' ||
                (Array.isArray(descendants) && descendants.length > 0);
            const iconName = properties['icon-name'];
            const hasIcon = typeof iconName === 'string' &&
                /^[A-Za-z0-9_.-]{1,128}$/.test(iconName);
            const row = nested
                ? new (depth > 0 ? NestedSubMenuItem : PopupMenu.PopupSubMenuMenuItem)(text, hasIcon)
                : hasIcon ? new PopupMenu.PopupImageMenuItem(text, iconName)
                    : new PopupMenu.PopupMenuItem(text);
            if (nested && hasIcon)
                row.icon.icon_name = iconName;
            row.setSensitive(properties.enabled !== false);
            if (properties['toggle-state'] === 1) {
                row.setOrnament(properties['toggle-type'] === 'radio'
                    ? PopupMenu.Ornament.DOT : PopupMenu.Ornament.CHECK);
            }
            menu.addMenuItem(row);
            if (nested) {
                this._render(row.menu, descendants, depth + 1);
                row.menu.connect('open-state-changed', (_submenu, open) => {
                    if (open) {
                        const generation = this._generation;
                        this._dbusMenu.layout(id).then(layout => {
                            if (!this._destroyed && generation === this._generation)
                                this._render(row.menu, this._findChildren(layout, id), depth + 1);
                        }).catch(error => console.warn(
                            '[NativeTray] Submenu unavailable: ' + error.message));
                    }
                });
            } else {
                row.connect('activate', () => this._dbusMenu.event(id));
            }
        }
    }

    _findChildren(layout, id) {
        if (layout[0] === id)
            return layout[2];
        for (const child of layout[2] || []) {
            const found = this._findChildren(child, id);
            if (found)
                return found;
        }
        return [];
    }

    destroy() {
        this._destroyed = true;
        this._section.disconnect(this._closedId);
        this._generation++;
        this._dbusMenu?.destroy();
        if (openRoot === this._menu)
            openRoot = null;
        this._menu?.destroy();
    }
}
