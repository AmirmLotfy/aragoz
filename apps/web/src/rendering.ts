/** Babylon sizes from CSS pixels unless adaptToDeviceRatio is explicitly enabled. */
export function hardwareScalingLevel(quality:'high'|'low',devicePixelRatio:number):number {
  const ratio=Number.isFinite(devicePixelRatio)?Math.max(1,devicePixelRatio):1;
  const pixelsPerCssPixel=quality==='low'?1:Math.min(1.5,ratio);
  return 1/pixelsPerCssPixel;
}
