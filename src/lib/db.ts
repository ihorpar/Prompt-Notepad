import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface PromptVersion {
  id?: number;
  name: string;
  content: string;
  format: 'markdown' | 'json' | 'xml';
  timestamp: number;
}

interface PromptDB extends DBSchema {
  versions: {
    key: number;
    value: PromptVersion;
    indexes: { 'by-timestamp': number };
  };
}

let dbPromise: Promise<IDBPDatabase<PromptDB>>;

export function initDB() {
  if (!dbPromise) {
    dbPromise = openDB<PromptDB>('prompt-editor-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('versions', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-timestamp', 'timestamp');
      },
    });
  }
  return dbPromise;
}

export async function saveVersion(content: string, format: 'markdown' | 'json' | 'xml', name: string) {
  const db = await initDB();
  return db.add('versions', {
    content,
    format,
    name,
    timestamp: Date.now(),
  });
}

export async function updateVersionName(id: number, name: string) {
  const db = await initDB();
  const version = await db.get('versions', id);
  if (version) {
    version.name = name;
    return db.put('versions', version);
  }
}

export async function getVersions(): Promise<PromptVersion[]> {
  const db = await initDB();
  return db.getAllFromIndex('versions', 'by-timestamp');
}

export async function clearVersions() {
  const db = await initDB();
  return db.clear('versions');
}
