import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { handle, MAX_DELETE_BATCH, type Deps } from '../src/app';
import { AppCheckError, AuthError, verifyIdToken } from '../src/auth';
import { signParams, uploadParams } from '../src/cloudinary';
import { CloudinaryError, createCloudinaryAdmin, type CloudinaryAdmin } from '../src/cloudinary-admin';
import { createFirestoreReader, PermissionError, type FirestoreDoc } from '../src/firestore';

// Offline tests: fake token verification and fake Firestore. No Google, no Cloudinary calls.

const LAURA = { uid: 'uid-laura', email: 'laura@gmail.com', token: 'token-laura' };
const TEACHER = { uid: 'uid-teacher', email: 'docente@gmail.com', token: 'token-teacher' };
const NOW = 1_700_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const BOARD = 'board1';

type Docs = Record<string, FirestoreDoc | 'forbidden'>;

type CloudinaryCalls = { deleteByIds: string[][]; deleteByPrefix: string[]; usage: number };

function fakeCloudinary(calls: CloudinaryCalls, options: { partialPages?: number; fail?: boolean } = {}): CloudinaryAdmin {
	let partialPages = options.partialPages ?? 0;
	return {
		deleteByIds: async (ids) => {
			if (options.fail) throw new CloudinaryError('down');
			calls.deleteByIds.push(ids);
			// one of them was already gone
			return Object.fromEntries(ids.map((id) => [id, id.endsWith('gone') ? 'not_found' : 'deleted']));
		},
		deleteByPrefix: async (prefix) => {
			calls.deleteByPrefix.push(prefix);
			const partial = partialPages-- > 0;
			return { deleted: partial ? 1000 : 3, partial };
		},
		usage: async () => {
			calls.usage += 1;
			return { credits: { used: 4.2, limit: 25, percent: 16.8 }, storageBytes: 1, bandwidthBytes: 2, transformations: 3, images: 4, updatedAt: null };
		},
	};
}

const GOOD_APP_CHECK = 'app-check-ok';
// Firestore reads, with the App Check token they were given (forwarding check)
const reads: { path: string; appCheck?: string }[] = [];

function deps(docs: Docs = {}, cloudinary?: CloudinaryAdmin): Deps {
	return {
		verifyAppCheck: async (token) => {
			if (token !== GOOD_APP_CHECK) throw new AppCheckError('bad app check');
		},
		verifyIdToken: async (token) => {
			if (token === LAURA.token) return LAURA;
			if (token === TEACHER.token) return TEACHER;
			throw new AuthError('bad token');
		},
		cloudinary: cloudinary ?? fakeCloudinary({ deleteByIds: [], deleteByPrefix: [], usage: 0 }),
		readDoc: async (path, _token, appCheck) => {
			reads.push({ path, appCheck });
			const doc = docs[path];
			if (doc === 'forbidden') throw new PermissionError(path);
			return doc ?? null;
		},
		now: () => NOW,
		newId: () => 'asset123',
	};
}

const joinedLaura: Docs = {
	[`boards/${BOARD}/members/${LAURA.uid}`]: { uid: LAURA.uid, studentId: 'st_laura' },
	[`boards/${BOARD}`]: { status: 'active' },
};

function sign(body: unknown, options: { token?: string; origin?: string } = {}) {
	return new Request('https://media-api.test/uploads/sign', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${options.token ?? LAURA.token}`,
			Origin: options.origin ?? 'http://localhost:5173',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
}

describe('cloudinary signature', () => {
	it("matches Cloudinary's documented example", async () => {
		// https://cloudinary.com/documentation/authentication_signatures
		const signature = await signParams(
			{ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 },
			'abcd',
		);
		expect(signature).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
	});

	it('builds the folder, tags and limits for a student upload', () => {
		expect(uploadParams({ env: 'prod', boardId: 'b1', studentId: 'st_1', assetId: 'a1', timestamp: 10 })).toEqual({
			public_id: 'pbl/prod/b1/st_1/a1',
			asset_folder: 'pbl/prod/b1/st_1',
			tags: 'board_b1,student_st_1,env_prod',
			allowed_formats: 'jpg,jpeg,png,webp,gif',
			transformation: 'c_limit,w_2560,h_2560',
			overwrite: 'false',
			timestamp: 10,
		});
	});
});

describe('POST /uploads/sign', () => {
	it('signs an upload into my own space (dev folder from localhost)', async () => {
		const response = await handle(sign({ boardId: BOARD, studentId: 'st_laura' }), env, deps(joinedLaura));
		expect(response.status).toBe(200);
		const body = (await response.json()) as { assetId: string; params: Record<string, string>; signature: string; apiKey: string };
		expect(body.assetId).toBe('asset123');
		expect(body.params.public_id).toBe(`pbl/dev/${BOARD}/st_laura/asset123`);
		expect(body.signature).toBe(await signParams(body.params, env.CLOUDINARY_API_SECRET));
		expect(body.apiKey).toBe(env.CLOUDINARY_API_KEY);
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
	});

	it('uses the prod folder from the deployed app', async () => {
		const response = await handle(
			sign({ boardId: BOARD, studentId: 'st_laura' }, { origin: 'https://diplomado-fc679.web.app' }),
			env,
			deps(joinedLaura),
		);
		const body = (await response.json()) as { params: Record<string, string> };
		expect(body.params.public_id.startsWith('pbl/prod/')).toBe(true);
	});

	it("refuses someone else's space", async () => {
		const response = await handle(sign({ boardId: BOARD, studentId: 'st_other' }), env, deps(joinedLaura));
		expect(response.status).toBe(403);
	});

	it('refuses when not a member, or when Firestore rules deny the read', async () => {
		expect((await handle(sign({ boardId: BOARD, studentId: 'st_laura' }), env, deps({}))).status).toBe(403);
		const denied = { [`boards/${BOARD}/members/${LAURA.uid}`]: 'forbidden' } as Docs;
		expect((await handle(sign({ boardId: BOARD, studentId: 'st_laura' }), env, deps(denied))).status).toBe(403);
	});

	it('refuses when the board is locked, archived or unused for too long (auto-archived)', async () => {
		const locked = { ...joinedLaura, [`boards/${BOARD}`]: { status: 'locked' } };
		expect((await handle(sign({ boardId: BOARD, studentId: 'st_laura' }), env, deps(locked))).status).toBe(403);
		const unused = {
			...joinedLaura,
			[`boards/${BOARD}`]: { status: 'active', archiveAfterDays: 90, lastActivityAt: NOW - 91 * DAY },
		};
		expect((await handle(sign({ boardId: BOARD, studentId: 'st_laura' }), env, deps(unused))).status).toBe(403);
		const recent = { ...unused, [`boards/${BOARD}`]: { status: 'active', archiveAfterDays: 90, lastActivityAt: NOW - 3 * DAY } };
		expect((await handle(sign({ boardId: BOARD, studentId: 'st_laura' }), env, deps(recent))).status).toBe(200);
	});

	it('requires a valid token', async () => {
		expect((await handle(sign({ boardId: BOARD, studentId: 'st_laura' }, { token: 'fake' }), env, deps(joinedLaura))).status).toBe(401);
		const noToken = new Request('https://media-api.test/uploads/sign', { method: 'POST' });
		expect((await handle(noToken, env, deps(joinedLaura))).status).toBe(401);
	});

	it('rejects malformed ids (no path tricks)', async () => {
		const response = await handle(sign({ boardId: '../other', studentId: 'st_laura' }), env, deps(joinedLaura));
		expect(response.status).toBe(400);
	});
});

describe('GET /me', () => {
	it('returns who is calling', async () => {
		const request = new Request('https://media-api.test/me', { headers: { Authorization: `Bearer ${LAURA.token}` } });
		const response = await handle(request, env, deps());
		expect(await response.json()).toEqual({ uid: LAURA.uid, email: LAURA.email });
	});
});

describe('verifyIdToken (emulator mode)', () => {
	const unsigned = (payload: object) =>
		`${btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${btoa(JSON.stringify(payload))}.`.replaceAll('=', '');

	it('accepts emulator tokens only for demo-* projects', async () => {
		const emulatorEnv = { ...env, AUTH_MODE: 'emulator', FIREBASE_PROJECT_ID: 'demo-pbl' };
		const token = unsigned({ sub: 'u1', aud: 'demo-pbl', email: 'A@Gmail.com', email_verified: true });
		await expect(verifyIdToken(token, emulatorEnv)).resolves.toMatchObject({ uid: 'u1', email: 'a@gmail.com' });

		const realProject = { ...env, AUTH_MODE: 'emulator', FIREBASE_PROJECT_ID: 'diplomado-fc679' };
		await expect(verifyIdToken(token, realProject)).rejects.toThrow(AuthError);
	});

	it('rejects malformed tokens with an auth error (→ 401, not 500)', async () => {
		const emulatorEnv = { ...env, AUTH_MODE: 'emulator', FIREBASE_PROJECT_ID: 'demo-pbl' };
		await expect(verifyIdToken('not-a-token', emulatorEnv)).rejects.toThrow(AuthError);
		await expect(verifyIdToken('not-a-token', env)).rejects.toThrow(AuthError);
	});

	it('rejects unverified emails', async () => {
		const emulatorEnv = { ...env, AUTH_MODE: 'emulator', FIREBASE_PROJECT_ID: 'demo-pbl' };
		const token = unsigned({ sub: 'u1', aud: 'demo-pbl', email: 'a@gmail.com', email_verified: false });
		await expect(verifyIdToken(token, emulatorEnv)).rejects.toThrow(AuthError);
	});

	it('production mode never accepts unsigned tokens', async () => {
		const token = unsigned({ sub: 'u1', aud: env.FIREBASE_PROJECT_ID, email: 'a@gmail.com', email_verified: true });
		await expect(verifyIdToken(token, env)).rejects.toThrow(AuthError);
	});
});

describe('firestore reader', () => {
	it('decodes REST documents and maps 404 / 403', async () => {
		const fakeFetch = (async (url: string) => {
			if (url.endsWith('/members/x')) return Response.json({ fields: { studentId: { stringValue: 'st_1' }, n: { integerValue: '3' } } });
			if (url.endsWith('/missing')) return new Response(null, { status: 404 });
			return new Response(null, { status: 403 });
		}) as unknown as typeof fetch;
		const read = createFirestoreReader(env, fakeFetch);
		expect(await read('boards/b/members/x', 't')).toEqual({ studentId: 'st_1', n: 3 });
		const withDate = createFirestoreReader(env, (async () =>
			Response.json({ fields: { at: { timestampValue: '2026-10-27T12:00:00.000Z' } } })) as unknown as typeof fetch);
		expect(await withDate('boards/b', 't')).toEqual({ at: Date.UTC(2026, 9, 27, 12) });
		expect(await read('boards/b/missing', 't')).toBeNull();
		await expect(read('boards/b/secret', 't')).rejects.toThrow(PermissionError);
	});
});

// ---------- M7: cleanup, purge, usage ----------

function post(path: string, body: unknown, options: { token?: string; origin?: string } = {}) {
	return new Request(`https://media-api.test${path}`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${options.token ?? TEACHER.token}`,
			Origin: options.origin ?? 'http://localhost:5173',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});
}

const asset = (assetId: string, status: string, board = BOARD) => ({
	publicId: `pbl/prod/${board}/st_laura/${assetId}`,
	studentId: 'st_laura',
	status,
});

const teacherBoard = (status = 'active'): Docs => ({
	[`boards/${BOARD}`]: { status, teacherEmails: [TEACHER.email] },
});

describe('POST /assets/delete', () => {
	it('deletes only orphaned images of this board, and reports each one', async () => {
		const calls: CloudinaryCalls = { deleteByIds: [], deleteByPrefix: [], usage: 0 };
		const docs: Docs = {
			...teacherBoard(),
			[`boards/${BOARD}/assets/a1`]: asset('a1', 'orphaned'),
			[`boards/${BOARD}/assets/gone`]: asset('gone', 'orphaned'),
			[`boards/${BOARD}/assets/used`]: asset('used', 'active'),
			[`boards/${BOARD}/assets/foreign`]: asset('foreign', 'orphaned', 'other-board'),
		};
		const response = await handle(
			post('/assets/delete', { boardId: BOARD, assetIds: ['a1', 'gone', 'used', 'foreign', 'missing'] }),
			env,
			deps(docs, fakeCloudinary(calls)),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			results: { a1: 'deleted', gone: 'not_found', used: 'skipped', foreign: 'skipped', missing: 'skipped' },
		});
		expect(calls.deleteByIds).toEqual([[`pbl/prod/${BOARD}/st_laura/a1`, `pbl/prod/${BOARD}/st_laura/gone`]]);
	});

	it('only the board teacher, and at most a batch per call', async () => {
		const docs = { ...teacherBoard(), [`boards/${BOARD}/assets/a1`]: asset('a1', 'orphaned') };
		const asStudent = await handle(post('/assets/delete', { boardId: BOARD, assetIds: ['a1'] }, { token: LAURA.token }), env, deps(docs));
		expect(asStudent.status).toBe(403);
		const tooMany = Array.from({ length: MAX_DELETE_BATCH + 1 }, (_, i) => `a${i}`);
		expect((await handle(post('/assets/delete', { boardId: BOARD, assetIds: tooMany }), env, deps(docs))).status).toBe(400);
		expect((await handle(post('/assets/delete', { boardId: BOARD, assetIds: ['../x'] }), env, deps(docs))).status).toBe(400);
		expect((await handle(post('/assets/delete', { boardId: BOARD, assetIds: [] }), env, deps(docs))).status).toBe(400);
	});

	it('a Cloudinary outage is a clean 502', async () => {
		const docs = { ...teacherBoard(), [`boards/${BOARD}/assets/a1`]: asset('a1', 'orphaned') };
		const cloudinary = fakeCloudinary({ deleteByIds: [], deleteByPrefix: [], usage: 0 }, { fail: true });
		const response = await handle(post('/assets/delete', { boardId: BOARD, assetIds: ['a1'] }), env, deps(docs, cloudinary));
		expect(response.status).toBe(502);
	});
});

describe('POST /boards/purge', () => {
	it('deletes both folders (prod and dev) of an archived board, page by page', async () => {
		const calls: CloudinaryCalls = { deleteByIds: [], deleteByPrefix: [], usage: 0 };
		const response = await handle(
			post('/boards/purge', { boardId: BOARD }),
			env,
			deps(teacherBoard('archived'), fakeCloudinary(calls, { partialPages: 2 })),
		);
		// prod: 2 full pages + the rest; then dev (images from local testing)
		expect(await response.json()).toEqual({ deleted: 2006, complete: true });
		expect(calls.deleteByPrefix).toEqual([...Array(3).fill(`pbl/prod/${BOARD}/`), `pbl/dev/${BOARD}/`]);
	});

	it('stops after a few pages and asks to be called again', async () => {
		const response = await handle(
			post('/boards/purge', { boardId: BOARD }),
			env,
			deps(teacherBoard('archived'), fakeCloudinary({ deleteByIds: [], deleteByPrefix: [], usage: 0 }, { partialPages: 99 })),
		);
		expect(await response.json()).toMatchObject({ complete: false });
	});

	it('refuses active boards and non-teachers', async () => {
		expect((await handle(post('/boards/purge', { boardId: BOARD }), env, deps(teacherBoard('active')))).status).toBe(409);
		expect(
			(await handle(post('/boards/purge', { boardId: BOARD }, { token: LAURA.token }), env, deps(teacherBoard('archived')))).status,
		).toBe(403);
	});
});

describe('GET /usage', () => {
	const usage = (token: string) => new Request('https://media-api.test/usage', { headers: { Authorization: `Bearer ${token}` } });

	it('teachers see the Cloudinary credits; students do not', async () => {
		const docs: Docs = { [`staffEmails/${TEACHER.email}`]: { role: 'teacher' } };
		const ok = await handle(usage(TEACHER.token), env, deps(docs));
		expect(await ok.json()).toMatchObject({ credits: { used: 4.2, limit: 25, percent: 16.8 } });
		expect((await handle(usage(LAURA.token), env, deps(docs))).status).toBe(403);
	});
});

describe('cloudinary admin client', () => {
	it('sends Basic auth, repeated public_ids[] and maps the usage report', async () => {
		const requests: { url: string; method: string; auth: string | null }[] = [];
		const fakeFetch = (async (url: string, init: RequestInit) => {
			requests.push({ url, method: init.method ?? 'GET', auth: new Headers(init.headers).get('Authorization') });
			if (url.includes('/usage'))
				return Response.json({ credits: { usage: 3, limit: 25, used_percent: 12 }, storage: { usage: 10 }, resources: 7 });
			return Response.json({ deleted: { 'pbl/prod/b/s/a1': 'deleted' }, partial: false });
		}) as unknown as typeof fetch;
		const admin = createCloudinaryAdmin(env, fakeFetch);

		expect(await admin.deleteByIds(['pbl/prod/b/s/a1', 'pbl/prod/b/s/a2'])).toEqual({ 'pbl/prod/b/s/a1': 'deleted' });
		expect(await admin.deleteByPrefix('pbl/prod/b/')).toEqual({ deleted: 1, partial: false });
		expect(await admin.usage()).toMatchObject({ credits: { used: 3, limit: 25, percent: 12 }, storageBytes: 10, images: 7 });

		expect(requests[0].method).toBe('DELETE');
		expect(requests[0].url).toBe(
			`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/resources/image/upload?public_ids%5B%5D=pbl%2Fprod%2Fb%2Fs%2Fa1&public_ids%5B%5D=pbl%2Fprod%2Fb%2Fs%2Fa2`,
		);
		expect(requests[1].url).toContain('prefix=pbl%2Fprod%2Fb%2F');
		expect(requests[0].auth).toBe(`Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}`);
		// no ids → no request
		expect(await admin.deleteByIds([])).toEqual({});
		expect(requests).toHaveLength(3);
	});
});

// ---------- M8: App Check ----------

describe('App Check', () => {
	const me = (headers: Record<string, string> = {}) =>
		new Request('https://media-api.test/me', { headers: { Authorization: `Bearer ${LAURA.token}`, ...headers } });
	const withMode = (mode: string) => ({ ...env, APP_CHECK: mode });

	it('enforce: requests without a valid App Check token are rejected', async () => {
		expect((await handle(me(), withMode('enforce'), deps())).status).toBe(401);
		expect((await handle(me({ 'X-Firebase-AppCheck': 'forged' }), withMode('enforce'), deps())).status).toBe(401);
		expect((await handle(me({ 'X-Firebase-AppCheck': GOOD_APP_CHECK }), withMode('enforce'), deps())).status).toBe(200);
	});

	it('monitor: only logs; off: not checked; emulators: always off', async () => {
		expect((await handle(me(), withMode('monitor'), deps())).status).toBe(200);
		expect((await handle(me({ 'X-Firebase-AppCheck': 'forged' }), withMode('off'), deps())).status).toBe(200);
		const emulator = { ...env, APP_CHECK: 'enforce', AUTH_MODE: 'emulator', FIREBASE_PROJECT_ID: 'demo-pbl' };
		const unsigned = `${btoa('{"alg":"none"}')}.${btoa(JSON.stringify({ sub: 'u', aud: 'demo-pbl', email: 'a@gmail.com', email_verified: true }))}.`;
		const request = new Request('https://media-api.test/me', { headers: { Authorization: `Bearer ${unsigned.replaceAll('=', '')}` } });
		// real verifyIdToken in emulator mode (deps only fakes the rest)
		const response = await handle(request, emulator, { ...deps(), verifyIdToken: (token) => verifyIdToken(token, emulator) });
		expect(response.status).toBe(200);
	});

	it("forwards the caller's App Check token to Firestore (works once Firestore enforces it)", async () => {
		reads.length = 0;
		await handle(
			new Request('https://media-api.test/uploads/sign', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${LAURA.token}`,
					'X-Firebase-AppCheck': GOOD_APP_CHECK,
					Origin: 'http://localhost:5173',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ boardId: BOARD, studentId: 'st_laura' }),
			}),
			withMode('enforce'),
			deps(joinedLaura),
		);
		expect(reads.length).toBeGreaterThan(0);
		expect(reads.every((read) => read.appCheck === GOOD_APP_CHECK)).toBe(true);
	});

	it('the browser may send the App Check header (CORS)', async () => {
		const preflight = new Request('https://media-api.test/uploads/sign', {
			method: 'OPTIONS',
			headers: { Origin: 'http://localhost:5173' },
		});
		const response = await handle(preflight, env, deps());
		expect(response.headers.get('Access-Control-Allow-Headers')).toContain('X-Firebase-AppCheck');
	});
});
