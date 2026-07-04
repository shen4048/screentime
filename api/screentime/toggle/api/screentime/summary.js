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

    const stats = {};
    const openAt = {};
    for (const e of events) {
      if (e.action === 'open') {
        openAt[e.app] = e.ts;
      } else if (openAt[e.app]) {
        const dur = e.ts - openAt[e.app];
        stats[e.app] = stats[e.app] || { count: 0, ms: 0 };
        stats[e.app].count += 1;
        stats[e.app].ms += dur;
        delete openAt[e.app];
      }
    }
    const summary = {};
    for (const app in stats) {
      summary[app] = {
        count: stats[app].count,
        minutes: Math.round(stats[app].ms / 60000)
      };
    }
    return res.status(200).json({
      date: new Date().toISOString().slice(0, 10),
      summary
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
