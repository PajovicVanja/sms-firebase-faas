let _clientPromise = null;
let _indexesEnsured = false;

export async function getDb() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || 'smsdb';
  if (!uri) throw new Error('Missing MONGODB_URI env var');

  if (!_clientPromise) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri, {});
    _clientPromise = client.connect();
  }
  const client = await _clientPromise;
  const db = client.db(dbName);

  if (!_indexesEnsured) {
    await db.collection('sms_templates').createIndex({ templateId: 1 }, { unique: true });
    await db.collection('sms_logs').createIndex({ createdAt: -1 });
    await db.collection('sms_logs').createIndex({ phone: 1, createdAt: -1 });
    _indexesEnsured = true;
  }
  return db;
}
