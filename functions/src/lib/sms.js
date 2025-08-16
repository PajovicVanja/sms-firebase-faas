export function renderTemplate(body, varsObj = {}) {
  if (typeof body !== 'string') throw new Error('Template body must be a string');
  return body.replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => {
    if (!(key in varsObj)) throw new Error(`Missing variable: ${key}`);
    const val = varsObj[key];
    return (val === undefined || val === null) ? '' : String(val);
  });
}

export function kvListToObject(list = []) {
  const obj = {};
  for (const kv of list) {
    if (!kv || typeof kv.key !== 'string') continue;
    obj[kv.key] = kv.value ?? '';
  }
  return obj;
}

export function objectToKvList(obj = {}) {
  return Object.entries(obj).map(([key, value]) => ({ key, value: value ?? '' }));
}

export async function sendSmsViaProvider({ to, text, senderId }) {
  const providerUrl = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY || '';
  if (!providerUrl) throw new Error('Missing SMS_API_URL env var');

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = 'Basic ' + Buffer.from(apiKey).toString('base64');

  const payload = { to, text };
  if (senderId) payload.senderId = senderId;

  const resp = await fetch(providerUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  let data = null;
  try { data = await resp.json(); } catch { data = null; }

  return { ok: resp.ok, status: resp.status, data };
}

export async function logSms(db, { phone, message, templateId = null, variables = {}, status = 'SENT', providerResponse = null }) {
  const doc = { phone, message, templateId, variables, status, providerResponse, createdAt: new Date() };
  const { insertedId } = await db.collection('sms_logs').insertOne(doc);
  return { id: String(insertedId), ...doc };
}
