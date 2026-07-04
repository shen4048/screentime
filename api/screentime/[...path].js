import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  const { path = [] } = req.query;
  const [action, appName] = path;

  try {
    if (action === 'toggle' && appName) {
      return await handleToggle(res, decodeURIComponent(appName));
    }
    if (action === 'summary') return await handleSummary(res);
    if (action === 'events') return await handleEvents(res);
    return res.status(200).json({ ok: true, msg: 'screentime api' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

async function handleToggle(res, app) {
  const now = Date.now();
  const stateKey = `state:${app}`;
  const last = await redis.get(stateKey);
  const nextAction = (!last || last.action === 'close') ? 'open' : 'close';

  await redis.set(stateKey, { action: nextAction, ts: now });
  await redis.set(
    `log:${now}:${app}`,
    { app, action: nextAction, ts: now },
    { ex: 86400 } // 24小时过期
  );
  return res.status(200).json({
    ok: true, app, action: nextAction,
    time: new Date(now).toISOString()
  });
}

async function handleEvents(res) {
  const keys = await redis.keys('log:*');
  const events = [];
  for (const k of keys) {
    const d = await redis.get(k);
    if (d) events.push(d);
  }
  events.sort((a, b) => a.ts - b.ts);
  return res.status(200).json({ events });
}

async function handleSummary(res) {
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
}
