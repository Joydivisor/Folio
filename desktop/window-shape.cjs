// Windows 10 has no system-rounded frame. Clip only the outer corners;
// leave the window fully rectangular while maximized or fullscreen.
exports.roundedRegion = (width, height, radius = 12) => {
  const r = Math.min(radius, Math.floor(width / 2), Math.floor(height / 2));
  const rects = [{ x: 0, y: r, width, height: height - 2 * r }];
  for (let y = 0; y < r; y++) {
    const inset = Math.ceil(r - Math.sqrt(r * r - (r - y - 0.5) ** 2));
    rects.push({ x: inset, y, width: width - 2 * inset, height: 1 });
    rects.push({ x: inset, y: height - 1 - y, width: width - 2 * inset, height: 1 });
  }
  return rects;
};
