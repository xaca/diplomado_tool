/**
 * media-api — server tasks that need the Cloudinary API secret (see PLAN.md → Architecture overview).
 * Runs on Cloudflare Workers (free tier). Routes are added step by step (PLAN.md → M4 walkthrough).
 */

type Handler = (request: Request, env: Env) => Promise<Response> | Response;

const routes: Record<string, Handler> = {
	'GET /health': (_request, env) =>
		json({
			ok: true,
			// Reports whether the secret exists, never its value
			config: env.CLOUDINARY_API_SECRET ? 'ok' : 'missing CLOUDINARY_API_SECRET',
		}),
};

export default {
	async fetch(request, env): Promise<Response> {
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
		const response = handler ? await handler(request, env) : json({ error: 'not found' }, 404);

		return withCors(response, allowedOrigin);
	},
} satisfies ExportedHandler<Env>;

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
