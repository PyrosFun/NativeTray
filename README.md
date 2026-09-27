# NativeTray

NativeTray brings StatusNotifier tray applications into GNOME Shell's **Background Apps** panel. It keeps GNOME's native presentation while adding access to application-provided tray menus and actions.

## Features

- Shows compatible tray applications in Quick Settings → **Background Apps**.
- Combines matching tray entries with GNOME's native background-app entries.
- Displays application-provided tray menus, including submenus and check states.
- Activates an app or uses its Show/Open action when available.
- Uses a published Quit, Exit, or Close action for the close button when available.

What NativeTray can do depends on the actions each application exposes. It does not force-quit an app that has no close action.

## Requirements

- GNOME Shell 50.
- Applications that use the StatusNotifierItem (SNI) protocol.
- NativeTray should be the only active StatusNotifier watcher. Disable other tray extensions while using it.

## Install

Download `nativetray-shell-extension.zip` from the latest project release, then install it from a terminal. Change the path if the ZIP was saved somewhere else:

```fish
gnome-extensions install --force ~/Downloads/nativetray-shell-extension.zip
gnome-extensions enable nativetray@pyrosfun.com
```

On Wayland, log out and back in after installation. Open Quick Settings and select **Background Apps**. If a tray application was already running while another extension owned the SNI watcher, restart that application.

## Update

Download the ZIP attached to the latest release and install it over the existing copy:

```fish
gnome-extensions disable nativetray@pyrosfun.com
gnome-extensions install --force ~/Downloads/nativetray-shell-extension.zip
gnome-extensions enable nativetray@pyrosfun.com
```

The installer extracts the extension into your user extensions directory; you do not need to copy files there yourself. On Wayland, log out and back in if the updated extension does not take effect immediately.

## Using NativeTray

Open **Quick Settings → Background Apps** to see active tray applications. Click an app to activate it; use the arrow or right-click to open its tray menu. The close button runs the app's published Quit, Exit, or Close action when one is available. For a matched GNOME background-app entry, GNOME's native close action is used as a fallback.

Open NativeTray's **Settings** in Extension Manager to adjust visibility, duplicate merging, and click behavior.

## Releases

Tagged releases are built and published by GitLab CI. Each release includes the installable ZIP and the matching section from `CHANGELOG.md`. To install a release, download the ZIP from the project's **Deploy → Releases** page and follow the update steps above.

## Development

Run the local checks with:

```fish
make validate
```

For GNOME Shell troubleshooting, inspect the current boot's relevant logs:

```fish
journalctl --user -b -o short-iso --no-pager -g 'NativeTray|nativetray|JS ERROR|StatusNotifier' -n 150
```

## License

NativeTray is released under the MIT No Attribution license (MIT-0). See [LICENSE](LICENSE).
