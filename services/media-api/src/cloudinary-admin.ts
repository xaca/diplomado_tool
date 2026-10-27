// Cloudinary Admin API (deleting images, usage). Basic auth with the API key + secret, so it only
// ever runs here. `CLOUDINARY_API_BASE` is overridable for the local integration test (fake server).

export type DeleteResult = Record<string, 'deleted' | 'not_found' | string>;

export type Usage = {
	credits: { used: number; limit: number; percent: number };
	storageBytes: number;
	bandwidthBytes: number;
	transformations: number;
	images: number;
	updatedAt: string | null;
};

export type CloudinaryAdmin = {
	/** Deletes these public ids (max 100 per call). */
	deleteByIds: (publicIds: string[]) => Promise<DeleteResult>;
	/** Deletes up to 1000 images under a folder prefix; `partial` means call again. */
	deleteByPrefix: (prefix: string) => Promise<{ deleted: number; partial: boolean }>;
	usage: () => Promise<Usage>;
};

export class CloudinaryError extends Error {}

type UsageResponse = {
	last_updated?: string;
	credits?: { usage?: number; limit?: number; used_percent?: number };
	storage?: { usage?: number };
	bandwidth?: { usage?: number };
	transformations?: { usage?: number };
	resources?: number;
	objects?: { usage?: number };
};

export function createCloudinaryAdmin(env: Env, fetchImpl: typeof fetch = fetch): CloudinaryAdmin {
	const base = `${env.CLOUDINARY_API_BASE || 'https://api.cloudinary.com'}/v1_1/${env.CLOUDINARY_CLOUD_NAME}`;
	const authorization = `Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}`;

	async function call<T>(method: 'GET' | 'DELETE', path: string, query: URLSearchParams = new URLSearchParams()) {
		const response = await fetchImpl(`${base}${path}${query.size ? `?${query}` : ''}`, {
			method,
			headers: { Authorization: authorization },
		});
		if (!response.ok) throw new CloudinaryError(`Cloudinary ${method} ${path}: ${response.status}`);
		return (await response.json()) as T;
	}

	return {
		async deleteByIds(publicIds) {
			if (publicIds.length === 0) return {};
			const query = new URLSearchParams();
			for (const id of publicIds) query.append('public_ids[]', id);
			const body = await call<{ deleted?: DeleteResult }>('DELETE', '/resources/image/upload', query);
			return body.deleted ?? {};
		},
		async deleteByPrefix(prefix) {
			const body = await call<{ deleted?: DeleteResult; partial?: boolean }>(
				'DELETE',
				'/resources/image/upload',
				new URLSearchParams({ prefix }),
			);
			return { deleted: Object.keys(body.deleted ?? {}).length, partial: body.partial === true };
		},
		async usage() {
			const body = await call<UsageResponse>('GET', '/usage');
			return {
				credits: {
					used: body.credits?.usage ?? 0,
					limit: body.credits?.limit ?? 0,
					percent: body.credits?.used_percent ?? 0,
				},
				storageBytes: body.storage?.usage ?? 0,
				bandwidthBytes: body.bandwidth?.usage ?? 0,
				transformations: body.transformations?.usage ?? 0,
				images: body.resources ?? body.objects?.usage ?? 0,
				updatedAt: body.last_updated ?? null,
			};
		},
	};
}
