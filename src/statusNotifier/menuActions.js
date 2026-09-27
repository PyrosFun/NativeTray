export function menuLabel(label) {
    return String(label || '').replace(/__|_./g, match =>
        match === '__' ? '_' : match[1]);
}

function normalizedLabel(label) {
    return menuLabel(label).trim().replace(/(?:\.{3}|…)$/, '')
        .replace(/\s+/g, ' ').toLowerCase();
}

export function findMenuActions(layout, appName) {
    const app = normalizedLabel(appName);
    const actions = {open: null, close: null};
    const scores = {open: -1, close: -1};
    const closeWords = ['quit', 'exit', 'close'];
    const openWords = ['show', 'open', 'restore'];

    function inspect(children) {
        for (const child of children || []) {
            const [id, properties, descendants] = child;
            if (!properties || properties.visible === false ||
                properties.enabled === false || properties.type === 'separator')
                continue;
            if (properties['children-display'] === 'submenu' || descendants?.length) {
                inspect(descendants);
                continue;
            }
            const label = normalizedLabel(properties.label);
            for (const [kind, words] of [['close', closeWords], ['open', openWords]]) {
                let score = -1;
                for (const [index, word] of words.entries()) {
                    const priority = (words.length - index) * 10;
                    if (label === word)
                        score = priority + 3;
                    else if (kind === 'open' && (label === `${word} window` ||
                        label === `${word} main window` || label === `${word} application`))
                        score = priority + 2;
                    else if (kind === 'close' && (label === `${word} application` ||
                        label === `${word} app`))
                        score = priority + 2;
                    else if (app && label === `${word} ${app}`)
                        score = priority + 1;
                }
                if (score > scores[kind]) {
                    actions[kind] = id;
                    scores[kind] = score;
                }
            }
        }
    }

    inspect(layout?.[2]);
    return actions;
}
