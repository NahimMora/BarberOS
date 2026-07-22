import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2, S3-compatible. Alcance acotado a fotos de cliente (ver
// AGENTS.md y docs/DECISIONS.md) — el resto de `files` sigue en Supabase
// Storage sin tocarse. Bucket privado: nunca servimos objetos públicos
// directo, siempre por URL firmada de vida corta generada acá.
function client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID y R2_SECRET_ACCESS_KEY son requeridos')
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

function bucket() {
  const name = process.env.R2_BUCKET_NAME
  if (!name) throw new Error('R2_BUCKET_NAME es requerido')
  return name
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export async function deleteFromR2(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}

export async function getR2SignedDownloadUrl(key: string, expiresInSeconds = 60): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket(), Key: key })
  return getSignedUrl(client(), command, { expiresIn: expiresInSeconds })
}
