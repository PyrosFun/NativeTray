import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const INTERFACE = 'com.canonical.dbusmenu';

export class DBusMenu {
    constructor(owner, path) {
        this.owner = owner;
        this.path = path;
        this._cancellable = new Gio.Cancellable();
        this._changed = null;
        this._signalId = Gio.DBus.session.signal_subscribe(
            owner, INTERFACE, null, path, null, Gio.DBusSignalFlags.NONE,
            (_connection, _sender, _path, _interface, signal) => {
                if (signal === 'LayoutUpdated' || signal === 'ItemsPropertiesUpdated')
                    this._changed?.();
            });
    }

    setChanged(callback) {
        this._changed = callback;
    }

    async layout(id = 0, prepare = true) {
        if (prepare)
            await this._call('AboutToShow', new GLib.Variant('(i)', [id]), '(b)');
        const result = await this._call('GetLayout',
            new GLib.Variant('(iias)', [0, 6, []]), '(u(ia{sv}av))');
        return result.recursiveUnpack()[1];
    }

    event(id) {
        this._call('Event', new GLib.Variant('(isvu)', [
            id, 'clicked', new GLib.Variant('s', ''),
            global.get_current_time() >>> 0,
        ]), null, null).catch(error => {
            console.warn('[NativeTray] Menu action failed: ' + error.message);
        });
    }

    _call(method, parameters, replyType, cancellable = this._cancellable) {
        return new Promise((resolve, reject) => {
            Gio.DBus.session.call(this.owner, this.path, INTERFACE, method,
                parameters, replyType ? new GLib.VariantType(replyType) : null,
                Gio.DBusCallFlags.NONE, 3000, cancellable,
                (connection, result) => {
                    try {
                        resolve(connection.call_finish(result));
                    } catch (error) {
                        reject(error);
                    }
                });
        });
    }

    destroy() {
        this._changed = null;
        this._cancellable.cancel();
        Gio.DBus.session.signal_unsubscribe(this._signalId);
    }
}
