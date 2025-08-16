import { getDb } from '../lib/db.js';
import { renderTemplate, kvListToObject, objectToKvList, sendSmsViaProvider, logSms } from '../lib/sms.js';

const SDL = /* GraphQL */ `
  type SmsTemplate {
    id: ID!
    templateId: String!
    name: String!
    body: String!
    variables: [String!]!
    createdAt: String!
    updatedAt: String
  }

  type VariableKV {
    key: String!
    value: String!
  }

  type SmsLog {
    id: ID!
    phone: String!
    message: String!
    templateId: String
    variables: [VariableKV!]!
    status: String!
    createdAt: String!
    providerResponse: String
  }

  input VariableKVInput {
    key: String!
    value: String!
  }

  input SendSmsInput {
    phone: String!
    message: String
    templateId: String
    variables: [VariableKVInput!]
    senderId: String
  }

  input UpsertTemplateInput {
    id: ID
    templateId: String
    name: String!
    body: String!
    variables: [String!]
  }

  type Query {
    templates(search: String): [SmsTemplate!]!
    templateById(id: ID!): SmsTemplate
    templateByTemplateId(templateId: String!): SmsTemplate
    smsLogs(limit: Int = 20, offset: Int = 0, phone: String, templateId: String): [SmsLog!]!
  }

  type Mutation {
    sendSms(input: SendSmsInput!): SmsLog!
    upsertTemplate(input: UpsertTemplateInput!): SmsTemplate!
    deleteTemplate(id: ID, templateId: String): Boolean!
  }
`;

let _schema = null;
async function getSchema() {
  if (_schema) return _schema;
  const { buildSchema } = await import('graphql');
  _schema = buildSchema(SDL);
  return _schema;
}

const resolvers = {
  // QUERIES
  async templates({ search }) {
    const db = await getDb();
    const q = search ? {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { templateId: { $regex: search, $options: 'i' } },
        { body: { $regex: search, $options: 'i' } }
      ]
    } : {};
    const list = await db.collection('sms_templates').find(q).sort({ _id: -1 }).toArray();
    return list.map(mapTemplate);
  },

  async templateById({ id }) {
    const db = await getDb();
    const { ObjectId } = await import('mongodb');
    let doc = null;
    try { doc = await db.collection('sms_templates').findOne({ _id: new ObjectId(id) }); } catch { doc = null; }
    return doc ? mapTemplate(doc) : null;
  },

  async templateByTemplateId({ templateId }) {
    const db = await getDb();
    const doc = await db.collection('sms_templates').findOne({ templateId });
    return doc ? mapTemplate(doc) : null;
  },

  async smsLogs({ limit = 20, offset = 0, phone, templateId }) {
    const db = await getDb();
    const q = {};
    if (phone) q.phone = phone;
    if (templateId) q.templateId = templateId;
    const list = await db.collection('sms_logs')
      .find(q)
      .sort({ createdAt: -1 })
      .skip(Math.max(0, offset))
      .limit(Math.min(200, Math.max(1, limit)))
      .toArray();
    return list.map(mapLog);
  },

  // MUTATIONS
  async upsertTemplate({ input }) {
    const db = await getDb();
    const coll = db.collection('sms_templates');

    const now = new Date();
    let filter = {};
    const update = {
      $set: {
        name: input.name,
        body: input.body,
        variables: Array.isArray(input.variables) ? input.variables : [],
        updatedAt: now
      },
      $setOnInsert: { createdAt: now }
    };

    if (input.id) {
      const { ObjectId } = await import('mongodb');
      try { filter = { _id: new ObjectId(input.id) }; } catch { throw new Error('Invalid id'); }
    } else if (input.templateId) {
      filter = { templateId: input.templateId };
      update.$set.templateId = input.templateId;
    } else {
      const slug = String(input.name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
      filter = { templateId: slug };
      update.$set.templateId = slug;
    }

    const res = await coll.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after' });
    return mapTemplate(res.value);
  },

  async deleteTemplate({ id, templateId }) {
    const db = await getDb();
    const coll = db.collection('sms_templates');
    let result;
    if (id) {
      const { ObjectId } = await import('mongodb');
      try { result = await coll.deleteOne({ _id: new ObjectId(id) }); } catch { return false; }
      return result.deletedCount > 0;
    }
    if (templateId) {
      result = await coll.deleteOne({ templateId });
      return result.deletedCount > 0;
    }
    throw new Error('Provide id or templateId');
  },

  async sendSms({ input }) {
    const db = await getDb();
    const { phone, templateId, variables = [], message, senderId } = input;
    if (!phone) throw new Error('phone is required');

    let text = message || '';
    let usedTemplateId = null;
    let varsObj = kvListToObject(variables);

    if (templateId) {
      const tpl = await db.collection('sms_templates').findOne({ templateId });
      if (!tpl) throw new Error(`Template not found: ${templateId}`);
      usedTemplateId = templateId;
      text = renderTemplate(tpl.body, varsObj);
    } else if (!text) {
      throw new Error('Either templateId or message must be provided');
    }

    const provider = await sendSmsViaProvider({
      to: phone,
      text,
      senderId: senderId || process.env.SMS_DEFAULT_SENDER_ID
    });

    const status = provider.ok ? 'SENT' : 'FAILED';
    const providerResponse = provider.data ? JSON.stringify(provider.data) : null;

    const log = await logSms(db, {
      phone,
      message: text,
      templateId: usedTemplateId,
      variables: varsObj,
      status,
      providerResponse
    });

    // shape for mapper
    return mapLog({
      _id: log.id,
      phone: log.phone,
      message: log.message,
      templateId: log.templateId,
      variables: log.variables,
      status: log.status,
      createdAt: log.createdAt,
      providerResponse: log.providerResponse
    });
  }
};

function mapTemplate(doc) {
  return {
    id: String(doc._id),
    templateId: doc.templateId,
    name: doc.name,
    body: doc.body,
    variables: Array.isArray(doc.variables) ? doc.variables : [],
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null
  };
}

function mapLog(doc) {
  const vars = typeof doc.variables === 'object' && doc.variables !== null ? objectToKvList(doc.variables) : [];
  return {
    id: String(doc._id),
    phone: doc.phone,
    message: doc.message,
    templateId: doc.templateId || null,
    variables: vars,
    status: doc.status || 'UNKNOWN',
    createdAt: (doc.createdAt ? new Date(doc.createdAt) : new Date()).toISOString(),
    providerResponse: doc.providerResponse || null
  };
}

export function registerGraphQLRoutes(app) {
  // Preflight
  app.options('/graphql', (_req, res) => res.status(204).end());

  app.post('/graphql', async (req, res) => {
    try {
      const { parse, execute, validate } = await import('graphql');
      const schema = await getSchema();

      const { query, variables, operationName } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ errors: [{ message: 'Body must be JSON with {query, variables?}' }] });
        }

      const doc = parse(query);
      const validationErrors = validate(schema, doc);
      if (validationErrors.length) {
        return res.status(400).json({ errors: validationErrors.map(e => ({ message: e.message })) });
      }

      const result = await execute({
        schema,
        document: doc,
        variableValues: variables,
        operationName,
        rootValue: resolvers,
        contextValue: {}
      });

      const status = result.errors?.length ? 400 : 200;
      return res.status(status).json(result);
    } catch (e) {
      console.error('GraphQL error', e);
      return res.status(500).json({ errors: [{ message: String(e?.message || e) }] });
    }
  });
}
