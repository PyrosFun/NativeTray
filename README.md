# NativeTray

**Bring StatusNotifier tray applications into GNOME Shell’s Background Apps panel.**

NativeTray turns GNOME’s background-app list into a practical system tray while keeping the native GNOME look and feel. It integrates applications that publish the StatusNotifierItem (SNI) protocol, reuses matching GNOME app entries, and exposes app-provided tray actions and menus.

## Features

- Displays compatible tray applications in Quick Settings → **Background Apps**
- Merges matching tray entries with GNOME’s native app entries
- Uses GNOME menu styling for app-provided tray menus, including nested items and check states
- Maps left-click to an app’s available show/open action, with activation fallback
- Uses an app’s Quit/Exit/Close action for the **×** button when available
- Offers preferences for tray visibility, duplicate merging, and click behavior

NativeTray does not terminate an application when it has no published close action. Tray menu actions and matching depend on information the application exposes.

## Requirements

- GNOME Shell 50
- A running GNOME session with StatusNotifierItem applications
- NativeTray must be the active StatusNotifier watcher. Disable other tray extensions, such as Status Tray, while using it.

## Install

1. Open this project’s **Deploy → Releases** page and download the ZIP attached to the latest release.
2. Install the ZIP from a terminal (adjust the path if your browser saved it elsewhere):

   ```fish
   gnome-extensions install --force ~/Downloads/nativetray@pyrosfun.com.shell-extension.zip
   ```

   GNOME’s installer extracts it into your per-user extensions directory; you do not need to manually copy files.
3. On Wayland, log out and back in after installation.
4. Enable NativeTray:

   ```fish
   gnome-extensions enable nativetray@pyrosfun.com
   ```

5. Open Quick Settings and select **Background Apps**. Start or restart tray applications if they were already running while another watcher owned the SNI bus name.

## Use and preferences

Open **Quick Settings → Background Apps** to see active entries. Left-click activates the app or uses a matching show/open action. Use the arrow to open an app’s GNOME-styled tray menu; right-click also requests the app’s context menu. The **×** button invokes a published close action when one is available, otherwise GNOME’s native close behavior for matched background apps.

Open NativeTray’s **Settings** from Extension Manager to change tray visibility, duplicate merging, middle-click behavior, or the left-click action.

## Releases

NativeTray follows the same tag-based release flow as PyroTile:

1. Add a `## X.Y.Z` section to `CHANGELOG.md` with the release notes.
2. Commit and push the changes.
3. Create and push a matching version tag. For example:

   ```fish
   git tag -a v0.1.2 -m "NativeTray 0.1.2"
   git push origin v0.1.2
   ```

GitLab CI builds the extension ZIP. For a semantic version tag such as `v0.1.2`, the release job takes the matching `0.1.2` section from `CHANGELOG.md`, publishes the GitLab Release, and attaches the ZIP.

## Development

Run local syntax, schema, metadata, and unit-test checks with:

```fish
make validate
```

GitLab CI creates packages. Its build artifact is available for 30 days; tagged releases are available from **Deploy → Releases**.

For troubleshooting, capture GNOME Shell logs with:

```fish
journalctl --user -b -o short-iso --no-pager -g 'NativeTray|nativetray|JS ERROR|StatusNotifier' -n 150
```

## License

NativeTray is available under the MIT No Attribution license (MIT-0). You can use, modify, redistribute, and sell it without attribution requirements; see [LICENSE](LICENSE). MIT-0 is listed as an OSI-approved license in the [SPDX License List](https://spdx.org/licenses/MIT-0.html).
