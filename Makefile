UUID := nativetray@pyrosfun.com

.PHONY: validate test

validate:
	glib-compile-schemas --strict --dry-run schemas
	node --check extension.js
	node --check prefs.js
	@for file in src/*.js src/statusNotifier/*.js; do node --check "$$file"; done
	node -e "const m = require('./metadata.json'); if (m.uuid !== '$(UUID)' || m['settings-schema'] !== 'org.gnome.shell.extensions.nativetray') process.exit(1)"
	$(MAKE) test

test:
	node --test tests/*.test.js
