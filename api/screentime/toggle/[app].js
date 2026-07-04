import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    const app = decodeURIComponent(req.query.app);
    const now = Date.now();
    const stateKey = `state:${app}`;
    const last = await redis.get(stateKey);
    const nextAction = (!last || last.action === 'close') ? 'open' : 'close';

    await redis.set(stateKey, { action: nextAction, ts: now });
    await redis.set(
      `log:${now}:${app}`,
      { app, action: nextAction, ts: now },
      { ex: 86400 }
    );
    return res.status(200).json({
      ok: true, app, action: nextAction,
      time: new Date(now).toISOString()
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
