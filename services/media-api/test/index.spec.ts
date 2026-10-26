import { SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('media-api', () => {
	it('GET /health answers ok', async () => {
		const response = await SELF.fetch('https://example.com/health');
		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({ ok: true });
	});

	it('unknown routes answer 404', async () => {
		const response = await SELF.fetch('https://example.com/nope');
		expect(response.status).toBe(404);
	});

	it('allows the app origin (CORS)', async () => {
		const response = await SELF.fetch('https://example.com/health', {
			headers: { Origin: 'http://localhost:5173' },
		});
		expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
	});

	it('rejects other origins', async () => {
		const response = await SELF.fetch('https://example.com/health', {
			headers: { Origin: 'https://evil.example' },
		});
		expect(response.status).toBe(403);
	});
});
