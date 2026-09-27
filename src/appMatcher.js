function desktopId(value) {
    return (value || '').toLowerCase().replace(/\.desktop$/, '');
}

function words(value) {
    return (value || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

function nameKey(value) {
    const parts = words(value);
    if (parts.at(-1) === 'client')
        parts.pop();
    return parts.join('');
}

export function findNativeMatch(nativeApps, item) {
    const id = desktopId(item.id);
    if (id) {
        const exact = nativeApps.find(app => desktopId(app.get_id()) === id);
        if (exact)
            return exact;
    }

    if (item.pid > 0) {
        const byPid = nativeApps.find(app => (app.get_pids() || []).includes(item.pid));
        if (byPid)
            return byPid;
    }

    const titleKey = nameKey(item.title);
    if (!titleKey || !id)
        return null;
    const candidates = nativeApps.filter(app => {
        const nativeKey = nameKey(app.get_name());
        return nativeKey === titleKey && words(id).includes(nativeKey);
    });
    return candidates.length === 1 ? candidates[0] : null;
}
