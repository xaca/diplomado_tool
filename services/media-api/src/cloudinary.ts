// Cloudinary signed uploads (PLAN.md → Images → Upload flow). The browser uploads the file
// directly to Cloudinary with these exact parameters; changing any of them breaks the signature.

export type UploadParams = Record<string, string | number>;

/** SHA-1 of the sorted `key=value` pairs joined with `&`, followed by the API secret. */
export async function signParams(params: UploadParams, apiSecret: string) {
	const toSign = Object.keys(params)
		.sort()
		.map((key) => `${key}=${params[key]}`)
		.join('&');
	const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(toSign + apiSecret));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The API secret, without the space or newline a paste can add (it would break every signature). */
export function cloudinarySecret(env: Pick<Env, 'CLOUDINARY_API_SECRET'>) {
	return (env.CLOUDINARY_API_SECRET ?? '').trim();
}

export const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,gif';
/** Incoming transformation: nothing larger than 2560 px is ever stored, even if the app is bypassed. */
export const INCOMING_TRANSFORMATION = 'c_limit,w_2560,h_2560';

export function uploadParams(input: { env: 'dev' | 'prod'; boardId: string; studentId: string; assetId: string; timestamp: number }) {
	const folder = `pbl/${input.env}/${input.boardId}/${input.studentId}`;
	return {
		public_id: `${folder}/${input.assetId}`,
		asset_folder: folder,
		tags: `board_${input.boardId},student_${input.studentId},env_${input.env}`,
		allowed_formats: ALLOWED_FORMATS,
		transformation: INCOMING_TRANSFORMATION,
		overwrite: 'false',
		timestamp: input.timestamp,
	} satisfies UploadParams;
}
