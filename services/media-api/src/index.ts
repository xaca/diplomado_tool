/**
 * media-api — server tasks that need the Cloudinary API secret (see PLAN.md → Architecture overview).
 * Runs on Cloudflare Workers (free tier). Routes live in app.ts; this file wires the real dependencies.
 */

import { handle } from './app';
import { verifyIdToken } from './auth';
import { createFirestoreReader } from './firestore';

export default {
	fetch(request, env): Promise<Response> {
		return handle(request, env, {
			verifyIdToken: (token) => verifyIdToken(token, env),
			readDoc: createFirestoreReader(env),
			now: () => Date.now(),
			newId: () => crypto.randomUUID().replaceAll('-', '').slice(0, 20),
		});
	},
} satisfies ExportedHandler<Env>;
