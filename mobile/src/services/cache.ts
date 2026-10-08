import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_VERSION = "v1";
const CACHE_TTL_MS = 30 * 60 * 1000;

type CacheEnvelope<T> = {
  timestamp: number;
  data: T;
};

function buildKey(key: string) {
  return `ktmona:${CACHE_VERSION}:${key}`;
}

export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(buildKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T> | null;
    if (!parsed?.timestamp) return null;
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(buildKey(key));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = { timestamp: Date.now(), data };
  await AsyncStorage.setItem(buildKey(key), JSON.stringify(envelope));
}
