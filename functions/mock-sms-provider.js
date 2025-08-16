export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch {} }

  return res.status(200).json({
    ok: true,
    provider: 'firebase-mock',
    received: body,
    ts: new Date().toISOString(),
  });
}
