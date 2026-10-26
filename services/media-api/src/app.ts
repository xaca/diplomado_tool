import { AuthError, bearerToken, type Caller } from './auth';
import { signParams, uploadParams } from './cloudinary';
import { PermissionError, type FirestoreReader } from './firestore';

// Request handling, independent of the runtime: index.ts wires the real dependencies,
// tests pass fakes (no network, no Cloudinary, no Google).

export type Deps = {
	verifyIdToken: (token: string) => Promise<Caller>;
	readDoc: FirestoreReader;
	now: () => number;
	newId: () => string;
};

type Handler = (request: Request, env: Env, deps: Deps) => Promise<Response> | Response;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function authenticate(request: Request, deps: Deps) {
	try {
		return await deps.verifyIdToken(bearerToken(request));
	} catch (error) {
		if (error instanceof AuthError) throw new HttpError(401, 'unauthenticated');
		throw error;
	}
}

/** Cloudinary folder per environment: local app → dev (easy to wipe), deployed app → prod. */
function environmentOf(request: Request): 'dev' | 'prod' {
	const origin = request.headers.get('Origin') ?? '';
	return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') ? 'dev' : 'prod';
}

/** May this user upload into this student's space? Asked to Firestore with the user's own token. */
async function assertCanUpload(caller: Caller, boardId: string, studentId: string, deps: Deps) {
	try {
		const member = await deps.readDoc(`boards/${boardId}/members/${caller.uid}`, caller.token);
		if (!member || member.studentId !== studentId) throw new HttpError(403, 'not your space');
		const board = await deps.readDoc(`boards/${boardId}`, caller.token);
		if (!board || board.status !== 'active') throw new HttpError(403, 'board is not active');
	} catch (error) {
		if (error instanceof PermissionError) throw new HttpError(403, 'forbidden');
		throw error;
	}
}

const routes: Record<string, Handler> = {
	'GET /health': (_request, env) =>
		json({
			ok: true,
			// Reports whether the secret exists, never its value
			config: env.CLOUDINARY_API_SECRET ? 'ok' : 'missing CLOUDINARY_API_SECRET',
		}),

	'GET /me': async (request, _env, deps) => {
		const caller = await authenticate(request, deps);
		return json({ uid: caller.uid, email: caller.email });
	},

	'POST /uploads/sign': async (request, env, deps) => {
		const caller = await authenticate(request, deps);
		const body = (await request.json().catch(() => null)) as { boardId?: unknown; studentId?: unknown } | null;
		const boardId = typeof body?.boardId === 'string' ? body.boardId : '';
		const studentId = typeof body?.studentId === 'string' ? body.studentId : '';
		if (!ID_PATTERN.test(boardId) || !ID_PATTERN.test(studentId)) throw new HttpError(400, 'invalid boardId or studentId');

		await assertCanUpload(caller, boardId, studentId, deps);

		const assetId = deps.newId();
		const params = uploadParams({
			env: environmentOf(request),
			boardId,
			studentId,
			assetId,
			timestamp: Math.floor(deps.now() / 1000),
		});
		const signature = await signParams(params, env.CLOUDINARY_API_SECRET);
		return json({
			assetId,
			cloudName: env.CLOUDINARY_CLOUD_NAME,
			apiKey: env.CLOUDINARY_API_KEY,
			params,
			signature,
		});
	},
};

export async function handle(request: Request, env: Env, deps: Deps): Promise<Response> {
	const origin = request.headers.get('Origin');
	const allowedOrigin = origin && allowedOrigins(env).includes(origin) ? origin : null;

	if (origin && !allowedOrigin) {
		return json({ error: 'origin not allowed' }, 403);
	}

	if (request.method === 'OPTIONS') {
		return withCors(new Response(null, { status: 204 }), allowedOrigin);
	}

	const { pathname } = new URL(request.url);
	const handler = routes[`${request.method} ${pathname}`];
	let response: Response;
	try {
		response = handler ? await handler(request, env, deps) : json({ error: 'not found' }, 404);
	} catch (error) {
		response =
			error instanceof HttpError ? json({ error: error.message }, error.status) : (console.error(error), json({ error: 'internal' }, 500));
	}
	return withCors(response, allowedOrigin);
}

function allowedOrigins(env: Env) {
	return env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
}

function withCors(response: Response, origin: string | null) {
	if (!origin) return response;
	const headers = new Headers(response.headers);
	headers.set('Access-Control-Allow-Origin', origin);
	headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
	headers.set('Access-Control-Max-Age', '86400');
	headers.set('Vary', 'Origin');
	return new Response(response.body, { status: response.status, headers });
}

function json(body: unknown, status = 200) {
	return Response.json(body, { status });
}
