import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { mediaApi, type SignedUpload } from '@/lib/media-api'
import { paths, type AssetKind, type ImageRef } from '@/model'
import { checkFile, prepareImage } from '@/features/assets/prepare-image'

// Upload flow (PLAN.md → Images → Upload flow):
// prepare in the browser → Worker signs → browser uploads straight to Cloudinary → register in Firestore.

export class UploadError extends Error {
  readonly reason: 'type' | 'tooLarge' | 'forbidden' | 'network'

  constructor(reason: UploadError['reason']) {
    super(reason)
    this.reason = reason
  }
}

type CloudinaryResponse = {
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
    throw new UploadError('network')
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

function sendToCloudinary(
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
        : reject(new UploadError('network'))
    xhr.onerror = () => reject(new UploadError('network'))
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
    )
  }

  const { bytes, ...ref } = toImageRef(
    signed,
    await sendToCloudinary(signed, prepared, onProgress),
  )

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
  return ref
}
