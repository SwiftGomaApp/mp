export class FakeRedis {
  constructor() {
    this.values = new Map();
    this.hashes = new Map();
    this.expiries = new Map();
  }

  #alive(key) {
    const at = this.expiries.get(key);
    if (at !== undefined && at <= Date.now()) {
      this.values.delete(key);
      this.hashes.delete(key);
      this.expiries.delete(key);
    }
  }

  async set(key, value, ...args) {
    this.#alive(key);
    const nx = args.includes("NX");
    if (nx && (this.values.has(key) || this.hashes.has(key))) return null;
    this.values.set(key, String(value));
    const ex = args.indexOf("EX");
    if (ex !== -1) this.expiries.set(key, Date.now() + Number(args[ex + 1]) * 1000);
    return "OK";
  }

  async get(key) {
    this.#alive(key);
    return this.values.get(key) ?? null;
  }

  async getdel(key) {
    const value = await this.get(key);
    this.values.delete(key);
    return value;
  }

  async del(...keys) {
    let removed = 0;
    for (const key of keys) {
      this.#alive(key);
      if (this.values.delete(key) || this.hashes.delete(key)) removed += 1;
      this.expiries.delete(key);
    }
    return removed;
  }

  async exists(key) {
    this.#alive(key);
    return this.values.has(key) || this.hashes.has(key) ? 1 : 0;
  }

  async incr(key) {
    this.#alive(key);
    const next = (Number(this.values.get(key)) || 0) + 1;
    this.values.set(key, String(next));
    return next;
  }

  async expire(key, seconds) {
    this.expiries.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async ttl(key) {
    this.#alive(key);
    const at = this.expiries.get(key);
    if (at === undefined) return this.values.has(key) || this.hashes.has(key) ? -1 : -2;
    return Math.max(Math.ceil((at - Date.now()) / 1000), 0);
  }

  async hset(key, ...fields) {
    const hash = this.hashes.get(key) ?? new Map();
    for (let i = 0; i < fields.length; i += 2) hash.set(String(fields[i]), String(fields[i + 1]));
    this.hashes.set(key, hash);
    return fields.length / 2;
  }

  async hget(key, field) {
    this.#alive(key);
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hincrby(key, field, amount) {
    const hash = this.hashes.get(key) ?? new Map();
    const next = (Number(hash.get(field)) || 0) + amount;
    hash.set(field, String(next));
    this.hashes.set(key, hash);
    return next;
  }

  multi() {
    const queue = [];
    const chain = new Proxy(
      {},
      {
        get: (_, name) => {
          if (name === "exec") return async () => Promise.all(queue.map((run) => run()));
          return (...args) => {
            queue.push(() => this[name](...args));
            return chain;
          };
        },
      },
    );
    return chain;
  }
}
