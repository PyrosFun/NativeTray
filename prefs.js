import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class NativeTrayPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Background Apps',
            description: 'StatusNotifier items in the GNOME Background Apps menu',
        });
        page.add(group);
        window.add(page);

        for (const [key, title, subtitle] of [
            ['show-sni-items', 'Show tray items', 'Keep the watcher running but hide its items'],
            ['merge-duplicates', 'Merge duplicates', 'Combine matching GNOME and tray entries'],
            ['middle-click-activates', 'Middle-click action', 'Send secondary activation to the app'],
        ]) {
            const row = new Adw.SwitchRow({title, subtitle});
            settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
            group.add(row);
        }

        const choices = ['Activate or show window', 'Open tray menu'];
        const values = ['activate', 'menu'];
        const actionRow = new Adw.ComboRow({
            title: 'Left click',
            subtitle: 'Choose what selecting an item does',
            model: Gtk.StringList.new(choices),
        });
        actionRow.selected = Math.max(0, values.indexOf(settings.get_string('left-click-action')));
        actionRow.connect('notify::selected', () =>
            settings.set_string('left-click-action', values[actionRow.selected]));
        settings.connect_object('changed::left-click-action', () => {
            const selected = values.indexOf(settings.get_string('left-click-action'));
            if (selected >= 0 && actionRow.selected !== selected)
                actionRow.selected = selected;
        }, window);
        group.add(actionRow);

        window._settings = settings;
    }
}
