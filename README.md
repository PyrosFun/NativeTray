# NativeTray

NativeTray integrates StatusNotifierItem apps into GNOME Shell 50's native Background Apps menu. Left-click prefers an app-provided Show/Open/Restore action, then falls back to SNI activation or GNOME's native app activation. Right-click or the menu button opens the app's tray menu.

Menus use GNOME's menu widgets and support actions, nested items, separators, disabled items, and check/radio state. The X prefers an app-provided Quit/Exit/Close action, including on matched native rows. Without one, native rows retain GNOME's close behavior; SNI-only rows show a disabled X. NativeTray does not kill SNI-only processes as a fallback.

## Test on GNOME Shell 50

Disable Status Tray before testing: only one extension can own the SNI watcher bus name. Build and install the release archive from this directory:

```fish
gnome-extensions disable status-tray@keithvassallo.com
gnome-extensions disable nativetray@pyrosfun.com
make pack
gnome-extensions install --force nativetray@pyrosfun.com.shell-extension.zip
```

On Wayland, log out and back in after installing the update. Then enable NativeTray:

```fish
gnome-extensions enable nativetray@pyrosfun.com
```

Start or restart an SNI app such as Steam or EShot. Open Quick Settings → Background Apps. Confirm the expanded arrow remains centered and the submenu has rounded top corners. Test left-click activation, right-click and menu-button opening, middle-click secondary activation, nested items, menu icons, and checkboxes. For an app with a Quit/Exit/Close menu action, check that X exits cleanly; for a matched native row such as Seafile, confirm the X and left-click fallbacks still work. Seafile and Seafile Client should appear as one row when their identity can be matched.

Use the Extensions app's NativeTray preferences to test hiding tray entries, disabling duplicate merging, and making left-click open the tray menu. Restore the defaults before reporting other behavior.

Then run:

```fish
gnome-extensions disable nativetray@pyrosfun.com
gnome-extensions enable nativetray@pyrosfun.com
```

Confirm SNI rows disappear when disabled and appear exactly once when re-enabled. Native rows should remain functional throughout. If an app does not re-register when the watcher changes, restart that app.

To inspect logs:

```fish
journalctl --user -b -o cat --no-pager | rg 'NativeTray|nativetray'
```

`make pack` needs `make`, `glib-compile-schemas`, `zip`, and `unzip`; it does not require Node. Contributors with Node installed can run JavaScript syntax, schema, metadata, and logic checks with `make validate`.

Known limits: action detection uses conservative English menu labels and cannot infer a tray action from apps that do not publish one. Apps without an SNI menu cannot expose tray actions through the native GNOME monitor. NativeTray cannot recover already-registered items from a competing watcher, so restart affected apps after changing watcher ownership. Some applications expose incomplete SNI metadata or icons, so compatibility still needs live testing. This release candidate targets GNOME Shell 50 only.

The GNOME Shell extension code depends on GNOME's private Background Apps implementation, which may change between Shell releases. `make pack` produces the self-contained installation archive. CI publishes that ZIP as a build artifact. This project is licensed GPL-3.0-or-later; see `LICENSE`.
