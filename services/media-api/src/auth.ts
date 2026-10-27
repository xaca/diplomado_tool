import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

// Who is calling? Verifies the Firebase ID token the app sends as `Authorization: Bearer <token>`
// (PLAN.md → M4 walkthrough, Step 7).

export type Caller = {
	uid: string;
	email: string;
	token: string;
	/** App Check token of the request, forwarded to Firestore (needed once App Check is enforced) */
	appCheck?: string;
};

export class AuthError extends Error {}

const GOOGLE_KEYS = createRemoteJWKSet(
	new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export function bearerToken(request: Request) {
	const header = request.headers.get('Authorization') ?? '';
	const [scheme, token] = header.split(' ');
	if (scheme !== 'Bearer' || !token) throw new AuthError('missing token');
	return token;
}

function toCaller(payload: Record<string, unknown>, token: string): Caller {
	if (typeof payload.sub !== 'string' || !payload.sub) throw new AuthError('no subject');
	if (payload.email_verified !== true || typeof payload.email !== 'string') throw new AuthError('email not verified');
	return { uid: payload.sub, email: payload.email.toLowerCase(), token };
}

export async function verifyIdToken(token: string, env: Env): Promise<Caller> {
	// Local emulators issue unsigned tokens. Accepted ONLY for "demo-*" projects, which can't exist in production.
	if (env.AUTH_MODE === 'emulator') {
		if (!env.FIREBASE_PROJECT_ID.startsWith('demo-')) throw new AuthError('emulator mode requires a demo-* project');
		let payload: ReturnType<typeof decodeJwt>;
		try {
			payload = decodeJwt(token);
		} catch {
			throw new AuthError('malformed token');
		}
		if (payload.aud !== env.FIREBASE_PROJECT_ID) throw new AuthError('wrong project');
		return toCaller(payload, token);
	}

	try {
		const { payload } = await jwtVerify(token, GOOGLE_KEYS, {
			issuer: `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}`,
			audience: env.FIREBASE_PROJECT_ID,
			algorithms: ['RS256'],
		});
		return toCaller(payload, token);
	} catch (error) {
		if (error instanceof AuthError) throw error;
		throw new AuthError('invalid token');
	}
}

// ---------- App Check (PLAN.md → M8) ----------

const APP_CHECK_KEYS = createRemoteJWKSet(new URL('https://firebaseappcheck.googleapis.com/v1/jwks'));

export class AppCheckError extends Error {}

/** Verifies the `X-Firebase-AppCheck` token: signed by Firebase App Check for this project. */
export async function verifyAppCheck(token: string, env: Env): Promise<void> {
	try {
		const { payload } = await jwtVerify(token, APP_CHECK_KEYS, {
			audience: `projects/${env.FIREBASE_PROJECT_ID}`,
			algorithms: ['RS256'],
		});
		if (typeof payload.iss !== 'string' || !payload.iss.startsWith('https://firebaseappcheck.googleapis.com/'))
			throw new AppCheckError('wrong issuer');
	} catch (error) {
		if (error instanceof AppCheckError) throw error;
		throw new AppCheckError('invalid app check token');
	}
}
