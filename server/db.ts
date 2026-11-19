import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;

export type DBErrorCategory =
  | 'PLACEHOLDER_SECRET'
  | 'AUTH_FAILED'
  | 'DNS_OR_NETWORK'
  | 'IP_ALLOWLIST_OR_TIMEOUT'
  | 'UNKNOWN';

export interface DBStatus {
  mode: 'atlas' | 'embedded';
  connected: boolean;
  persistent: boolean;
  dataClassification: 'CONFIGURED_EXTERNAL_DB' | 'SIMULATED_SANDBOX_FALLBACK';
  envSource: 'MONGODB_URL' | 'MONGODB_URI' | 'NONE';
  uriMasked: string;
  error?: string;
  errorCategory?: DBErrorCategory;
  whitelistNotice?: string;
}

let dbStatus: DBStatus = {
  mode: 'embedded',
  connected: false,
  persistent: false,
  dataClassification: 'SIMULATED_SANDBOX_FALLBACK',
  envSource: 'NONE',
  uriMasked: ''
};

export function maskMongoUri(rawUri: string): string {
  const trimmed = (rawUri || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) {
      const userPart = parsed.username ? `${parsed.username}:` : '';
      return `${parsed.protocol}//${userPart}****@${parsed.host}${parsed.pathname}${parsed.search}`;
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return trimmed.replace(/\/\/([^:/]+):([^@]+)@/, '//$1:****@');
  }
}

export function classifyMongoError(message: string): DBErrorCategory {
  const msg = (message || '').toLowerCase();
  if (msg.includes('<db_password>') || msg.includes('<password>') || msg.includes('placeholder')) {
    return 'PLACEHOLDER_SECRET';
  }
  if (msg.includes('authentication failed') || msg.includes('bad auth') || msg.includes('auth error')) {
    return 'AUTH_FAILED';
  }
  if (msg.includes('enotfound') || msg.includes('querysrv') || msg.includes('econnrefused')) {
    return 'DNS_OR_NETWORK';
  }
  if (msg.includes('timed out') || msg.includes('server selection') || msg.includes('whitelist')) {
    return 'IP_ALLOWLIST_OR_TIMEOUT';
  }
  return 'UNKNOWN';
}

export function getDBStatus(): DBStatus {
  return { ...dbStatus };
}

export async function pingDB(): Promise<{ ok: boolean; latencyMs: number; readyState: number }> {
  const start = Date.now();
  const readyState = mongoose.connection.readyState;
  if (readyState !== 1 || !mongoose.connection.db) {
    return { ok: false, latencyMs: Date.now() - start, readyState };
  }
  try {
    await mongoose.connection.db.admin().ping();
    return { ok: true, latencyMs: Date.now() - start, readyState };
  } catch {
    return { ok: false, latencyMs: Date.now() - start, readyState: mongoose.connection.readyState };
  }
}

export async function connectDB(): Promise<string> {
  const uri = process.env.MONGODB_URL || process.env.MONGODB_URI;
  const envSource: DBStatus['envSource'] = process.env.MONGODB_URL
    ? 'MONGODB_URL'
    : process.env.MONGODB_URI
    ? 'MONGODB_URI'
    : 'NONE';

  console.log('MONGODB_URL / MONGODB_URI configured:', !!uri);
  console.log('Selected MongoDB variable:', envSource);

  const hasPlaceholderPassword =
    !!uri && (uri.includes('<db_password>') || uri.includes('<password>'));

  const isExternalConfigured =
    !!uri &&
    uri.trim().length > 0 &&
    !uri.includes('MY_MONGODB_URI') &&
    !uri.includes('MY_MONGODB_URL') &&
    !uri.includes('user:password@cluster0') &&
    !hasPlaceholderPassword;

  if (mongoose.connection.readyState === 1) {
    await mongoose.disconnect();
  }

  let atlasFailureError: string | undefined;
  let atlasErrorCategory: DBErrorCategory | undefined;
  let atlasNotice: string | undefined;

  if (hasPlaceholderPassword && uri) {
    const maskedUri = maskMongoUri(uri);
    console.log(
      `[MongoDB Notice] Template placeholder "<db_password>" detected in ${envSource}. Using embedded MongoDB sandbox engine.`
    );

    atlasFailureError = `Template placeholder <db_password> detected in ${envSource}`;
    atlasErrorCategory = 'PLACEHOLDER_SECRET';
    atlasNotice = `Your ${envSource} contains a template placeholder. Replace it in environment secrets with your actual MongoDB database password to use persistent external storage.`;
  } else if (isExternalConfigured && uri) {
    const maskedUri = maskMongoUri(uri);
    console.log(`Attempting connection to external MongoDB (${maskedUri})...`);

    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000
      });

      dbStatus = {
        mode: 'atlas',
        connected: true,
        persistent: true,
        dataClassification: 'CONFIGURED_EXTERNAL_DB',
        envSource,
        uriMasked: maskedUri
      };

      console.log('Connected to external MongoDB successfully.');

      if (mongoMemoryServer) {
        await mongoMemoryServer.stop();
        mongoMemoryServer = null;
      }

      return uri;
    } catch (err: any) {
      const sanitizedMsg = maskMongoUri(err?.message || 'Unknown MongoDB connection error');
      atlasErrorCategory = classifyMongoError(sanitizedMsg);
      atlasFailureError = sanitizedMsg;
      atlasNotice = sanitizedMsg;

      console.log(
        `[MongoDB Notice] External MongoDB connection did not succeed (${atlasErrorCategory}: ${sanitizedMsg}). Running with embedded sandbox engine.`
      );

      try {
        await mongoose.disconnect();
      } catch {
        // ignore cleanup error
      }
    }
  }

  if (!mongoMemoryServer) {
    mongoMemoryServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'veloop_rewards'
      }
    });
  }

  const memoryUri = mongoMemoryServer.getUri();
  await mongoose.connect(memoryUri);

  dbStatus = {
    mode: 'embedded',
    connected: true,
    persistent: false,
    dataClassification: 'SIMULATED_SANDBOX_FALLBACK',
    envSource,
    uriMasked: maskMongoUri(memoryUri),
    ...(atlasFailureError ? { error: atlasFailureError } : {}),
    ...(atlasErrorCategory ? { errorCategory: atlasErrorCategory } : {}),
    ...(atlasNotice ? { whitelistNotice: atlasNotice } : {})
  };

  console.log('Embedded MongoDB sandbox engine ready (non-persistent in-memory storage).');

  return memoryUri;
}

export async function closeDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
    mongoMemoryServer = null;
  }
  dbStatus.connected = false;
  dbStatus.persistent = false;
}
