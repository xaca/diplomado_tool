import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { mediaApi, type SignedUpload } from '@/lib/media-api'
import { paths, type AssetKind, type ImageRef } from '@/model'
import { checkFile, prepareImage } from '@/features/assets/prepare-image'

// Upload flow (PLAN.md → Images → Upload flow):
// prepare in the browser → Worker signs → browser uploads straight to Cloudinary → register in Firestore.

export class UploadError extends Error {
  /** `config`: the image service rejects our credentials (only the teacher/admin can fix it) */
  readonly reason: 'type' | 'tooLarge' | 'forbidden' | 'network' | 'config'
  /** Which step failed (logged, so a failure can be traced without guessing) */
  readonly stage: 'check' | 'sign' | 'cloudinary' | 'response' | 'register'

  constructor(
    reason: UploadError['reason'],
    stage: UploadError['stage'] = 'check',
    options?: ErrorOptions,
  ) {
    super(`${reason} at ${stage}`, options)
    this.reason = reason
    this.stage = stage
  }
}

/** Logs why an upload failed (the toast only shows a short message). */
export function logUploadFailure(error: unknown) {
  const stage = error instanceof UploadError ? error.stage : 'unknown'
  console.error(`[upload] failed at ${stage}`, error)
}

export type CloudinaryResponse = {
  public_id: string
  version: number
  width: number
  height: number
  format: string
  bytes: number
}

/** Validates Cloudinary's answer belongs to the upload we signed (pure, unit-tested). */
export function toImageRef(
  signed: Pick<SignedUpload, 'assetId' | 'params'>,
  response: unknown,
): ImageRef & { bytes: number } {
  const body = response as Partial<CloudinaryResponse>
  if (
    body?.public_id !== signed.params.public_id ||
    typeof body.version !== 'number' ||
    typeof body.width !== 'number' ||
    typeof body.height !== 'number' ||
    typeof body.format !== 'string' ||
    typeof body.bytes !== 'number'
  ) {
    throw new UploadError('network', 'response', {
      cause: { expected: signed.params.public_id, received: response },
    })
  }
  return {
    assetId: signed.assetId,
    publicId: body.public_id,
    version: body.version,
    width: body.width,
    height: body.height,
    format: body.format,
    bytes: body.bytes,
  }
}

/** Cloudinary rejected the upload: keep its explanation (`{ error: { message } }`) for the log. */
export function cloudinaryError(status: number, body: unknown) {
  const message = (body as { error?: { message?: unknown } } | null)?.error
    ?.message
  // 401 "Invalid Signature": the Worker's API secret doesn't match the API key
  return new UploadError(status === 401 ? 'config' : 'network', 'cloudinary', {
    cause: `${status} ${typeof message === 'string' ? message : ''}`.trim(),
  })
}

/** The asset registry write failed: the rules said no, or Firestore couldn't be reached. */
export function registerError(error: unknown) {
  const code = (error as { code?: unknown } | null)?.code
  return new UploadError(
    code === 'permission-denied' ? 'forbidden' : 'network',
    'register',
    { cause: error },
  )
}

export function sendToCloudinary(
  signed: SignedUpload,
  file: Blob,
  onProgress?: (percent: number) => void,
) {
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', signed.apiKey)
  form.append('signature', signed.signature)
  for (const [key, value] of Object.entries(signed.params))
    form.append(key, String(value))

  // XMLHttpRequest instead of fetch: it reports upload progress
  return new Promise<unknown>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(
      'POST',
      `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
    )
    xhr.responseType = 'json'
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.response)
        : reject(cloudinaryError(xhr.status, xhr.response))
    xhr.onerror = () =>
      reject(new UploadError('network', 'cloudinary', { cause: 'no response' }))
    xhr.send(form)
  })
}

export async function uploadImage(options: {
  file: File
  boardId: string
  studentId: string
  kind: AssetKind
  onProgress?: (percent: number) => void
}): Promise<ImageRef> {
  const { file, boardId, studentId, kind, onProgress } = options
  const problem = checkFile(file)
  if (problem) throw new UploadError(problem)

  let prepared: Blob
  try {
    prepared = await prepareImage(file)
  } catch {
    throw new UploadError('tooLarge')
  }

  let signed: SignedUpload
  try {
    signed = await mediaApi.signUpload(boardId, studentId)
  } catch (error) {
    const status = (error as { status?: number }).status
    throw new UploadError(
      status === 401 || status === 403 ? 'forbidden' : 'network',
      'sign',
      { cause: error },
    )
  }

  const { bytes, ...ref } = toImageRef(
    signed,
    await sendToCloudinary(signed, prepared, onProgress),
  )

  try {
    await setDoc(doc(db, paths.asset(boardId, ref.assetId)), {
      publicId: ref.publicId,
      studentId,
      kind,
      width: ref.width,
      height: ref.height,
      format: ref.format,
      bytes,
      status: 'active',
      createdAt: serverTimestamp(),
    })
  } catch (error) {
    // The image is already in Cloudinary but not in the registry: name it in the log
    console.error(`[upload] untracked image in Cloudinary: ${ref.publicId}`)
    throw registerError(error)
  }
  return ref
}
