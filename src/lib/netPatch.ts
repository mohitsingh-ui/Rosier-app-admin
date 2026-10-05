/**
 * Network safety net for slow or sleeping servers (e.g. the backend waking up):
 *  - every request gives up after 25 s instead of hanging forever (so screens can
 *    show their saved copy or a "try again" message), and
 *  - a GET that fails because of the network is retried once after a short pause.
 */
const TIMEOUT = 25_000;

const g = globalThis as any;
if (g.fetch && !g.__rosierFetch) {
  const orig = g.fetch.bind(globalThis);
  g.__rosierFetch = orig;
  const once = (input: any, init: any = {}) => {
    if (init.signal || typeof AbortController === 'undefined') return orig(input, init);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT);
    return orig(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(t));
  };
  g.fetch = async (input: any, init: any = {}) => {
    const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    try {
      return await once(input, init);
    } catch (e) {
      if (method !== 'GET' || init?.signal) throw e;
      await new Promise((r) => setTimeout(r, 1200));
      return once(input, init);
    }
  };
}
export {};
