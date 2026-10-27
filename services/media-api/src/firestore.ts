// Reads Firestore through its REST API **with the caller's own Firebase token**, so the same
// Security Rules as in the app decide what the Worker may see (PLAN.md → Step 8).

export type FirestoreDoc = Record<string, unknown>;

export type FirestoreReader = (path: string, idToken: string) => Promise<FirestoreDoc | null>;

type Value = {
	stringValue?: string;
	timestampValue?: string;
	integerValue?: string;
	booleanValue?: boolean;
	nullValue?: null;
	arrayValue?: { values?: Value[] };
	mapValue?: { fields?: Record<string, Value> };
};

function decode(value: Value): unknown {
	if ('stringValue' in value) return value.stringValue;
	// RFC 3339 string → milliseconds
	if ('timestampValue' in value) return Date.parse(value.timestampValue ?? '');
	if ('integerValue' in value) return Number(value.integerValue);
	if ('booleanValue' in value) return value.booleanValue;
	if ('arrayValue' in value) return (value.arrayValue?.values ?? []).map(decode);
	if ('mapValue' in value) return decodeFields(value.mapValue?.fields ?? {});
	return null;
}

function decodeFields(fields: Record<string, Value>): FirestoreDoc {
	return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

export class PermissionError extends Error {}

export function createFirestoreReader(env: Env, fetchImpl: typeof fetch = fetch): FirestoreReader {
	const base = env.FIRESTORE_HOST || 'https://firestore.googleapis.com';
	return async (path, idToken) => {
		const url = `${base}/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
		const response = await fetchImpl(url, { headers: { Authorization: `Bearer ${idToken}` } });
		if (response.status === 404) return null;
		if (response.status === 403 || response.status === 401) throw new PermissionError(path);
		if (!response.ok) throw new Error(`Firestore ${response.status} for ${path}`);
		const body = (await response.json()) as { fields?: Record<string, Value> };
		return decodeFields(body.fields ?? {});
	};
}
