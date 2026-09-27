import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {argbToRgba, selectPixmap} from './pixmap.js';

const XML = '<node><interface name="org.kde.StatusNotifierItem">' +
    '<property name="Id" type="s" access="read"/>' +
    '<property name="Title" type="s" access="read"/>' +
    '<property name="Status" type="s" access="read"/>' +
    '<property name="IconName" type="s" access="read"/>' +
    '<property name="IconPixmap" type="a(iiay)" access="read"/>' +
    '<property name="IconThemePath" type="s" access="read"/>' +
    '<property name="AttentionIconName" type="s" access="read"/>' +
    '<property name="AttentionIconPixmap" type="a(iiay)" access="read"/>' +
    '<property name="ToolTip" type="(sa(iiay)ss)" access="read"/>' +
    '<property name="Menu" type="o" access="read"/>' +
    '<property name="ItemIsMenu" type="b" access="read"/>' +
    '<method name="Activate"><arg type="i" direction="in"/><arg type="i" direction="in"/></method>' +
    '<method name="ContextMenu"><arg type="i" direction="in"/><arg type="i" direction="in"/></method>' +
    '<method name="SecondaryActivate"><arg type="i" direction="in"/><arg type="i" direction="in"/></method>' +
    '<signal name="NewIcon"/><signal name="NewTitle"/>' +
    '<signal name="NewStatus"><arg type="s"/></signal>' +
    '</interface></node>';
const ItemProxy = Gio.DBusProxy.makeProxyWrapper(XML);
const iconTheme = new St.IconTheme();

export class StatusNotifierItem {
    constructor(owner, path, changed) {
        this.owner = owner;
        this.path = path;
        this._changed = changed;
        this._cancellable = new Gio.Cancellable();
        this._destroyed = false;
        this._cachedIcon = null;
        this.pid = 0;
        this.proxy = null;
        new ItemProxy(Gio.DBus.session, owner, path, (proxy, error) => {
            if (this._destroyed)
                return;
            if (error) {
                console.warn('[NativeTray] SNI item unavailable: ' + error.message);
                return;
            }
            this.proxy = proxy;
            proxy.connectObject(
                'g-properties-changed', () => this._notifyChanged(),
                'g-signal', () => this._notifyChanged(),
                this);
            this._notifyChanged();
        }, this._cancellable);
        this._loadPid();
    }

    get id() {
        return this._property('Id') || '';
    }

    get title() {
        const title = this._property('Title');
        if (title && !/^chrome_status_icon_\d+$/i.test(title))
            return title;
        return this._property('ToolTip')?.[2] ||
            this.app?.get_name() || title || this.id || this.owner;
    }

    get app() {
        const id = this.id;
        if (id) {
            const desktopId = id.endsWith('.desktop') ? id : id + '.desktop';
            const app = Shell.AppSystem.get_default().lookup_app(desktopId);
            if (app)
                return app;
        }
        return this.pid > 0
            ? Shell.WindowTracker.get_default().get_app_from_pid(this.pid)
            : null;
    }

    _loadPid() {
        Gio.DBus.session.call(
            'org.freedesktop.DBus', '/org/freedesktop/DBus',
            'org.freedesktop.DBus', 'GetConnectionUnixProcessID',
            new GLib.Variant('(s)', [this.owner]), new GLib.VariantType('(u)'),
            Gio.DBusCallFlags.NONE, 2000, this._cancellable,
            (connection, result) => {
                try {
                    const pid = connection.call_finish(result).deepUnpack()[0];
                    if (!this._destroyed && pid > 0) {
                        this.pid = pid;
                        this._notifyChanged();
                    }
                } catch {
                    // Some sandbox proxies do not expose a usable process ID.
                }
            });
    }

    _notifyChanged() {
        this._cachedIcon = null;
        this._changed();
    }

    get icon() {
        if (this._cachedIcon)
            return this._cachedIcon;
        const attention = this.status === 'NeedsAttention';
        const iconName = attention
            ? this._property('AttentionIconName') || this._property('IconName')
            : this._property('IconName');
        this._cachedIcon = this._namedIcon(iconName) ||
            (attention ? this._pixmapIcon('AttentionIconPixmap') : null) ||
            this._pixmapIcon('IconPixmap') ||
            this._namedIcon(this._property('ToolTip')?.[0]) ||
            this.app?.get_icon() ||
            new Gio.ThemedIcon({name: 'application-x-executable-symbolic'});
        return this._cachedIcon;
    }

    _namedIcon(iconName) {
        if (typeof iconName !== 'string' || !iconName || iconName.length > 512)
            return null;
        if (GLib.path_is_absolute(iconName)) {
            const file = Gio.File.new_for_path(iconName);
            return file.query_exists(null) ? new Gio.FileIcon({file}) : null;
        }
        if (iconName.includes('/') || iconName.includes('..'))
            return null;

        const themePath = this._property('IconThemePath');
        if (themePath && GLib.path_is_absolute(themePath)) {
            const directories = ['', 'hicolor', 'scalable/apps', 'scalable/status',
                'hicolor/scalable/apps', 'hicolor/scalable/status'];
            for (const size of ['16x16', '22x22', '24x24', '32x32', '48x48']) {
                for (const category of ['apps', 'status']) {
                    directories.push(size + '/' + category);
                    directories.push('hicolor/' + size + '/' + category);
                }
            }
            for (const directory of directories) {
                for (const suffix of ['', '.png', '.svg']) {
                    const path = GLib.build_filenamev(
                        [themePath, directory, iconName + suffix]);
                    const file = Gio.File.new_for_path(path);
                    if (file.query_exists(null))
                        return new Gio.FileIcon({file});
                }
            }
        }
        return iconTheme.has_icon(iconName)
            ? new Gio.ThemedIcon({name: iconName}) : null;
    }

    _pixmapIcon(propertyName) {
        const pixmap = selectPixmap(this._property(propertyName));
        if (!pixmap)
            return null;
        try {
            const [width, height, argb] = pixmap;
            const pixels = GLib.Bytes.new(argbToRgba(argb));
            const buffer = GdkPixbuf.Pixbuf.new_from_bytes(pixels,
                GdkPixbuf.Colorspace.RGB, true, 8, width, height, width * 4);
            const [saved, png] = buffer.save_to_bufferv('png', [], []);
            return saved ? Gio.BytesIcon.new(GLib.Bytes.new(png)) : null;
        } catch (error) {
            console.warn('[NativeTray] Invalid SNI pixmap: ' + error.message);
            return null;
        }
    }

    get status() {
        return this._property('Status') || 'Active';
    }

    get menuPath() {
        const path = this._property('Menu');
        return path && path !== '/' ? path : null;
    }

    get isMenu() {
        return this._property('ItemIsMenu') === true;
    }

    activate(fallback) {
        Gio.DBus.session.call(this.owner, this.path,
            'org.kde.StatusNotifierItem', 'Activate',
            new GLib.Variant('(ii)', [0, 0]), null,
            Gio.DBusCallFlags.NONE, 2000, this._cancellable,
            (connection, result) => {
                try {
                    connection.call_finish(result);
                } catch (error) {
                    if (!this._destroyed) {
                        if (fallback)
                            fallback();
                        else
                            console.warn('[NativeTray] SNI activation failed: ' + error.message);
                    }
                }
            });
    }

    contextMenu() {
        Gio.DBus.session.call(this.owner, this.path,
            'org.kde.StatusNotifierItem', 'ContextMenu',
            new GLib.Variant('(ii)', [0, 0]), null,
            Gio.DBusCallFlags.NONE, 2000, this._cancellable,
            (connection, result) => {
                try {
                    connection.call_finish(result);
                } catch (error) {
                    if (!this._destroyed)
                        console.warn('[NativeTray] SNI context menu failed: ' + error.message);
                }
            });
    }

    secondaryActivate() {
        Gio.DBus.session.call(this.owner, this.path,
            'org.kde.StatusNotifierItem', 'SecondaryActivate',
            new GLib.Variant('(ii)', [0, 0]), null,
            Gio.DBusCallFlags.NONE, 2000, this._cancellable,
            (connection, result) => {
                try {
                    connection.call_finish(result);
                } catch (error) {
                    if (!this._destroyed)
                        console.warn('[NativeTray] Secondary activation failed: ' + error.message);
                }
            });
    }

    _property(name) {
        try {
            return this.proxy?.get_cached_property(name)?.deepUnpack();
        } catch (error) {
            console.warn('[NativeTray] Invalid SNI property ' + name + ': ' + error.message);
            return null;
        }
    }

    destroy() {
        this._destroyed = true;
        this._cancellable.cancel();
        this.proxy?.disconnectObject(this);
        this.proxy = null;
    }
}
