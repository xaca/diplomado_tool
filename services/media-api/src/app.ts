import { AppCheckError, AuthError, bearerToken, type Caller } from './auth';
import { signParams, uploadParams } from './cloudinary';
import { CloudinaryError, type CloudinaryAdmin } from './cloudinary-admin';
import { PermissionError, type FirestoreDoc, type FirestoreReader } from './firestore';

// Request handling, independent of the runtime: index.ts wires the real dependencies,
// tests pass fakes (no network, no Cloudinary, no Google).

export type Deps = {
	verifyIdToken: (token: string) => Promise<Caller>;
	verifyAppCheck: (token: string) => Promise<void>;
	readDoc: FirestoreReader;
	cloudinary: CloudinaryAdmin;
	now: () => number;
	newId: () => string;
};

type Handler = (request: Request, env: Env, deps: Deps) => Promise<Response> | Response;

const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Free Workers plan: 50 outgoing requests per call → 40 asset reads + board + Cloudinary */
export const MAX_DELETE_BATCH = 40;
/** Purge: at most this many Cloudinary calls (1000 images each) per request; the app calls again */
const MAX_PURGE_PAGES = 5;

class HttpError extends Error {
	constructor(
		readonly status: number,
		message: string,
	) {
		super(message);
	}
}

async function authenticate(request: Request, env: Env, deps: Deps): Promise<Caller> {
	let caller: Caller;
	try {
		caller = await deps.verifyIdToken(bearerToken(request));
	} catch (error) {
		if (error instanceof AuthError) throw new HttpError(401, 'unauthenticated');
		throw error;
	}
	return { ...caller, appCheck: await checkAppCheck(request, env, deps) };
}

/**
 * App Check (M8): `enforce` rejects requests without a valid token from the app; `monitor` only
 * logs them (to try it before enforcing); `off` skips it. Always off with the local emulators.
 */
async function checkAppCheck(request: Request, env: Env, deps: Deps) {
	const mode = env.AUTH_MODE === 'emulator' ? 'off' : (env.APP_CHECK ?? 'off');
	if (mode === 'off') return undefined;
	const token = request.headers.get('X-Firebase-AppCheck') ?? '';
	try {
		if (!token) throw new AppCheckError('missing app check token');
		await deps.verifyAppCheck(token);
		return token;
	} catch (error) {
		if (!(error instanceof AppCheckError)) throw error;
		if (mode === 'enforce') throw new HttpError(401, 'app check required');
		console.warn(`[app-check] ${error.message} (monitor mode: allowed)`);
		return token || undefined;
	}
}

/** Cloudinary folder per environment: local app → dev (easy to wipe), deployed app → prod. */
function environmentOf(request: Request): 'dev' | 'prod' {
	const origin = request.headers.get('Origin') ?? '';
	return origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') ? 'dev' : 'prod';
}

/** Firestore permission errors (the rules said no) become 403. */
async function asCaller<T>(read: () => Promise<T>): Promise<T> {
	try {
		return await read();
	} catch (error) {
		if (error instanceof PermissionError) throw new HttpError(403, 'forbidden');
		throw error;
	}
}

/** Same as isWritable() in the app (src/features/boards/lifecycle.ts) and boardIsActive() in the rules. */
function isWritable(board: FirestoreDoc, now: number) {
	const last = typeof board.lastActivityAt === 'number' ? board.lastActivityAt : NaN;
	const days = typeof board.archiveAfterDays === 'number' ? board.archiveAfterDays : 90;
	return board.status === 'active' && !(last + days * DAY_MS <= now);
}

/** May this user upload into this student's space? Asked to Firestore with the user's own token. */
async function assertCanUpload(caller: Caller, boardId: string, studentId: string, deps: Deps) {
	await asCaller(async () => {
		const member = await deps.readDoc(`boards/${boardId}/members/${caller.uid}`, caller.token, caller.appCheck);
		if (!member || member.studentId !== studentId) throw new HttpError(403, 'not your space');
		const board = await deps.readDoc(`boards/${boardId}`, caller.token, caller.appCheck);
		if (!board || !isWritable(board, deps.now())) throw new HttpError(403, 'board is not active');
	});
}

/** The caller must be one of the board's teachers. Returns the board. */
async function assertBoardTeacher(caller: Caller, boardId: string, deps: Deps) {
	const board = await asCaller(() => deps.readDoc(`boards/${boardId}`, caller.token, caller.appCheck));
	const teachers = Array.isArray(board?.teacherEmails) ? board.teacherEmails : [];
	if (!board || !teachers.includes(caller.email)) throw new HttpError(403, 'not a teacher of this board');
	return board;
}

async function readBody(request: Request) {
	return ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
}

function boardIdFrom(body: Record<string, unknown>) {
	const boardId = typeof body.boardId === 'string' ? body.boardId : '';
	if (!ID_PATTERN.test(boardId)) throw new HttpError(400, 'invalid boardId');
	return boardId;
}

/** Images of this board only, in either environment folder, named after their registry id. */
function belongsToBoard(publicId: unknown, boardId: string, assetId: string): publicId is string {
	return typeof publicId === 'string' && new RegExp(`^pbl/(dev|prod)/${boardId}/[A-Za-z0-9_-]{1,128}/${assetId}$`).test(publicId);
}

async function cloudinaryCall<T>(call: () => Promise<T>) {
	try {
		return await call();
	} catch (error) {
		if (error instanceof CloudinaryError) {
			console.error(error.message);
			throw new HttpError(502, 'cloudinary unavailable');
		}
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

	'GET /me': async (request, env, deps) => {
		const caller = await authenticate(request, env, deps);
		return json({ uid: caller.uid, email: caller.email });
	},

	'POST /uploads/sign': async (request, env, deps) => {
		const caller = await authenticate(request, env, deps);
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

	/**
	 * Cleanup (M7): deletes unused images of a board from Cloudinary. Only the board's teacher, and
	 * only images the app already marked "orphaned" in the registry (read with the teacher's token).
	 */
	'POST /assets/delete': async (request, env, deps) => {
		const caller = await authenticate(request, env, deps);
		const body = await readBody(request);
		const boardId = boardIdFrom(body);
		const assetIds: unknown[] = Array.isArray(body.assetIds) ? body.assetIds : [];
		if (
			assetIds.length === 0 ||
			assetIds.length > MAX_DELETE_BATCH ||
			!assetIds.every((id): id is string => typeof id === 'string' && ID_PATTERN.test(id))
		)
			throw new HttpError(400, `assetIds: 1 to ${MAX_DELETE_BATCH} ids`);
		const ids = assetIds as string[];

		await assertBoardTeacher(caller, boardId, deps);
		const assets = await asCaller(() => Promise.all(ids.map((id) => deps.readDoc(`boards/${boardId}/assets/${id}`, caller.token, caller.appCheck))));

		const results: Record<string, 'deleted' | 'not_found' | 'skipped'> = {};
		const toDelete = new Map<string, string>(); // publicId → assetId
		ids.forEach((assetId, index) => {
			const asset = assets[index];
			if (asset?.status === 'orphaned' && belongsToBoard(asset.publicId, boardId, assetId)) toDelete.set(asset.publicId, assetId);
			else results[assetId] = 'skipped';
		});

		const deleted = await cloudinaryCall(() => deps.cloudinary.deleteByIds([...toDelete.keys()]));
		for (const [publicId, assetId] of toDelete) results[assetId] = deleted[publicId] === 'deleted' ? 'deleted' : 'not_found';
		return json({ results });
	},

	/** Purge (M7): deletes every image of an archived board. Call again while `complete` is false. */
	'POST /boards/purge': async (request, env, deps) => {
		const caller = await authenticate(request, env, deps);
		const boardId = boardIdFrom(await readBody(request));
		const board = await assertBoardTeacher(caller, boardId, deps);
		if (board.status !== 'archived') throw new HttpError(409, 'only archived boards can be purged');

		// Both environment folders: images uploaded while testing from localhost belong to the board too
		let deleted = 0;
		let pages = 0;
		for (const prefix of [`pbl/prod/${boardId}/`, `pbl/dev/${boardId}/`]) {
			for (;;) {
				if (pages++ >= MAX_PURGE_PAGES) return json({ deleted, complete: false });
				const result = await cloudinaryCall(() => deps.cloudinary.deleteByPrefix(prefix));
				deleted += result.deleted;
				if (!result.partial) break;
			}
		}
		return json({ deleted, complete: true });
	},

	/** Cloudinary credits used this month (teacher dashboard meter). Any teacher. */
	'GET /usage': async (request, env, deps) => {
		const caller = await authenticate(request, env, deps);
		// staffEmails/{my email} is readable only by myself: it exists → I'm a teacher
		const staff = await asCaller(() => deps.readDoc(`staffEmails/${caller.email}`, caller.token, caller.appCheck));
		if (!staff) throw new HttpError(403, 'teachers only');
		return json(await cloudinaryCall(() => deps.cloudinary.usage()));
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
	headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Firebase-AppCheck');
	headers.set('Access-Control-Max-Age', '86400');
	headers.set('Vary', 'Origin');
	return new Response(response.body, { status: response.status, headers });
}

function json(body: unknown, status = 200) {
	return Response.json(body, { status });
}
