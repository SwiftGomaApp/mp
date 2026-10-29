const BROWSERS: readonly (readonly [RegExp, string])[] = [
  [/\bEdgA?\/|\bEdgiOS\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\//, "Chrome"],
  [/\bVersion\/[\d.]+.*\bSafari\//, "Safari"],
];

const SYSTEMS: readonly (readonly [RegExp, string])[] = [
  [/\bWindows\b/, "Windows"],
  [/\bAndroid\b/, "Android"],
  [/\biPhone\b|\biPad\b|\biPod\b/, "iOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bLinux\b|\bX11\b/, "Linux"],
];

function firstMatch(
  list: readonly (readonly [RegExp, string])[],
  text: string,
): string | undefined {
  return list.find(([pattern]) => pattern.test(text))?.[1];
}

export function describeBrowser(userAgent: string | undefined): string | undefined {
  if (!userAgent) return undefined;
  const browser = firstMatch(BROWSERS, userAgent);
  const system = firstMatch(SYSTEMS, userAgent);
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system;
}
