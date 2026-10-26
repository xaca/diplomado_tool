import { env } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { handle, type Deps } from '../src/app';
import { AuthError, verifyIdToken } from '../src/auth';
import { signParams, uploadParams } from '../src/cloudinary';
import { createFirestoreReader, PermissionError, type FirestoreDoc } from '../src/firestore';

// Offline tests: fake token verification and fake Firestore. No Google, no Cloudinary calls.

const LAURA = { uid: 'uid-laura', email: 'laura@gmail.com', token: 'token-laura' };
const BOARD = 'board1';

type Docs = Record<string, FirestoreDoc | 'forbidden'>;

function deps(docs: Docs = {}): Deps {
	return {
		verifyIdToken: async (token) => {
			if (token === LAURA.token) return LAURA;
			throw new AuthError('bad token');
		},
		readDoc: async (path) => {
			const doc = docs[path];
			if (doc === 'forbidden') throw new PermissionError(path);
			return doc ?? null;
		},
		now: () => 1_700_000_000_000,
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

	it('refuses when the board is locked or archived', async () => {
		const locked = { ...joinedLaura, [`boards/${BOARD}`]: { status: 'locked' } };
		expect((await handle(sign({ boardId: BOARD, studentId: 'st_laura' }), env, deps(locked))).status).toBe(403);
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
		expect(await read('boards/b/missing', 't')).toBeNull();
		await expect(read('boards/b/secret', 't')).rejects.toThrow(PermissionError);
	});
});
