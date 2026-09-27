export function selectPixmap(pixmaps, targetSize = 24) {
    if (!Array.isArray(pixmaps))
        return null;
    const valid = pixmaps.filter(([width, height, data]) =>
        Number.isInteger(width) && Number.isInteger(height) &&
        width > 0 && height > 0 && width <= 256 && height <= 256 &&
        data && data.length === width * height * 4);
    valid.sort((a, b) =>
        Math.abs(Math.max(a[0], a[1]) - targetSize) -
        Math.abs(Math.max(b[0], b[1]) - targetSize));
    return valid[0] || null;
}

export function argbToRgba(argb) {
    const rgba = new Uint8Array(argb.length);
    for (let i = 0; i < argb.length; i += 4) {
        rgba[i] = argb[i + 1];
        rgba[i + 1] = argb[i + 2];
        rgba[i + 2] = argb[i + 3];
        rgba[i + 3] = argb[i];
    }
    return rgba;
}
