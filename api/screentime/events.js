import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
  try {
    const keys = await redis.keys('log:*');
    const events = [];
    for (const k of keys) {
      const d = await redis.get(k);
      if (d) events.push(d);
    }
    events.sort((a, b) => a.ts - b.ts);
    return res.status(200).json({ events });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
