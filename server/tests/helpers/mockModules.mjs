import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

export const srcPath = (path) => fileURLToPath(new URL(`../../src/${path}`, import.meta.url));

export function loadWithMocks(target, mocks) {
  const saved = new Map();

  for (const [path, exports] of Object.entries(mocks)) {
    const id = path.startsWith("pkg:")
      ? require.resolve(path.slice(4))
      : require.resolve(srcPath(path));
    saved.set(id, require.cache[id]);
    require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [] };
  }

  const targetId = require.resolve(srcPath(target));
  const previousTarget = require.cache[targetId];
  delete require.cache[targetId];

  try {
    return require(targetId);
  } finally {
    for (const [id, previous] of saved) {
      if (previous) require.cache[id] = previous;
      else delete require.cache[id];
    }
    if (previousTarget) require.cache[targetId] = previousTarget;
    else delete require.cache[targetId];
  }
}
