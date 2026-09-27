UUID := nativetray@pyrosfun.com
ARCHIVE := $(UUID).shell-extension.zip
SOURCES := extension.js prefs.js stylesheet.css metadata.json README.md CHANGELOG.md LICENSE

.PHONY: validate test pack install clean schema-check

schema-check:
	glib-compile-schemas --strict --dry-run schemas

validate: schema-check
	node --check extension.js
	node --check prefs.js
	@for file in src/*.js src/statusNotifier/*.js; do node --check "$$file"; done
	node -e "const m = require('./metadata.json'); if (m.uuid !== '$(UUID)' || m['settings-schema'] !== 'org.gnome.shell.extensions.nativetray') process.exit(1)"
	$(MAKE) test

test:
	node --test tests/*.test.js

pack: schema-check
	@command -v zip >/dev/null && command -v unzip >/dev/null || \
	  { echo "Packaging requires zip and unzip" >&2; exit 1; }
	@set -eu; stage="$$(mktemp -d)"; trap 'rm -rf "$$stage"' EXIT; \
	  cp $(SOURCES) "$$stage/"; \
	  cp -R src schemas "$$stage/"; \
	  glib-compile-schemas --strict "$$stage/schemas"; \
	  rm -f "$(CURDIR)/$(ARCHIVE)"; \
	  (cd "$$stage" && zip -q -r "$(CURDIR)/$(ARCHIVE)" $(SOURCES) src schemas)
	@unzip -tq "$(ARCHIVE)"

install: pack
	gnome-extensions install --force "$(ARCHIVE)"

clean:
	rm -f "$(ARCHIVE)"
