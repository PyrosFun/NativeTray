import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const NAME = 'org.kde.StatusNotifierWatcher';
const XML = '<node><interface name="org.kde.StatusNotifierWatcher">' +
    '<method name="RegisterStatusNotifierItem"><arg name="service" type="s" direction="in"/></method>' +
    '<method name="RegisterStatusNotifierHost"><arg name="service" type="s" direction="in"/></method>' +
    '<property name="RegisteredStatusNotifierItems" type="as" access="read"/>' +
    '<property name="IsStatusNotifierHostRegistered" type="b" access="read"/>' +
    '<property name="ProtocolVersion" type="i" access="read"/>' +
    '<signal name="StatusNotifierItemRegistered"><arg type="s"/></signal>' +
    '<signal name="StatusNotifierItemUnregistered"><arg type="s"/></signal>' +
    '<signal name="StatusNotifierHostRegistered"/>' +
    '</interface></node>';

export class StatusNotifierWatcher {
    constructor(onRegistered, onUnregistered) {
        this._onRegistered = onRegistered;
        this._onUnregistered = onUnregistered;
        this._items = new Map();
        this._cancellable = new Gio.Cancellable();
        this._destroyed = false;
        this._connection = null;
        this._exported = Gio.DBusExportedObject.wrapJSObject(XML, this);
        this._ownerId = Gio.bus_own_name(
            Gio.BusType.SESSION, NAME, Gio.BusNameOwnerFlags.NONE,
            connection => {
                if (this._destroyed)
                    return;
                this._connection = connection;
                this._exported.export(connection, '/StatusNotifierWatcher');
            },
            () => {
                if (!this._destroyed) {
                    this._exported.emit_signal('StatusNotifierHostRegistered', null);
                    console.debug('[NativeTray] SNI watcher acquired');
                }
            },
            () => {
                if (!this._destroyed)
                    console.warn('[NativeTray] SNI watcher unavailable; disable another tray extension');
            });
    }

    get RegisteredStatusNotifierItems() {
        return [...this._items.keys()];
    }

    get IsStatusNotifierHostRegistered() {
        return true;
    }

    get ProtocolVersion() {
        return 0;
    }

    async RegisterStatusNotifierItemAsync([service], invocation) {
        try {
            const sender = invocation.get_sender();
            const slash = service.indexOf('/');
            const name = service.startsWith('/') ? sender :
                slash < 0 ? service : service.slice(0, slash);
            const path = service.startsWith('/') ? service :
                slash < 0 ? '/StatusNotifierItem' : service.slice(slash);
            if (!name || !/^\/(?:[A-Za-z0-9_]+\/)*[A-Za-z0-9_]+$/.test(path))
                throw new Error('Invalid SNI registration');
            const owner = name === sender ? sender : await this._getNameOwner(name);
            if (this._destroyed)
                throw new Error('NativeTray was disabled');
            this._register(owner, path);
            invocation.return_value(null);
        } catch (error) {
            console.warn('[NativeTray] SNI registration failed: ' + error.message);
            invocation.return_dbus_error('org.freedesktop.DBus.Error.InvalidArgs',
                error.message);
        }
    }

    RegisterStatusNotifierHostAsync(_params, invocation) {
        invocation.return_value(null);
    }

    _getNameOwner(name) {
        return new Promise((resolve, reject) => {
            this._connection.call(
                'org.freedesktop.DBus', '/org/freedesktop/DBus',
                'org.freedesktop.DBus', 'GetNameOwner',
                new GLib.Variant('(s)', [name]), new GLib.VariantType('(s)'),
                Gio.DBusCallFlags.NONE, 2000, this._cancellable,
                (connection, result) => {
                    try {
                        resolve(connection.call_finish(result).deepUnpack()[0]);
                    } catch (error) {
                        reject(error);
                    }
                });
        });
    }

    _register(owner, path) {
        const key = owner + path;
        if (this._items.has(key))
            return;
        const signalId = this._connection.signal_subscribe(
            'org.freedesktop.DBus', 'org.freedesktop.DBus',
            'NameOwnerChanged', '/org/freedesktop/DBus', owner,
            Gio.DBusSignalFlags.NONE,
            (_connection, _sender, _path, _interface, _signal, parameters) => {
                if (!parameters.deepUnpack()[2])
                    this._unregister(key);
            });
        this._items.set(key, {signalId});
        this._exported.emit_signal('StatusNotifierItemRegistered',
            new GLib.Variant('(s)', [key]));
        this._exported.emit_property_changed('RegisteredStatusNotifierItems',
            new GLib.Variant('as', this.RegisteredStatusNotifierItems));
        this._onRegistered(key, owner, path);
    }

    _unregister(key) {
        const item = this._items.get(key);
        if (!item)
            return;
        this._connection.signal_unsubscribe(item.signalId);
        this._items.delete(key);
        this._exported.emit_signal('StatusNotifierItemUnregistered',
            new GLib.Variant('(s)', [key]));
        this._exported.emit_property_changed('RegisteredStatusNotifierItems',
            new GLib.Variant('as', this.RegisteredStatusNotifierItems));
        this._onUnregistered(key);
    }

    destroy() {
        this._destroyed = true;
        this._cancellable.cancel();
        if (this._connection) {
            for (const item of this._items.values())
                this._connection.signal_unsubscribe(item.signalId);
        }
        this._items.clear();
        Gio.bus_unown_name(this._ownerId);
        if (this._connection)
            this._exported.unexport();
        this._connection = null;
    }
}
