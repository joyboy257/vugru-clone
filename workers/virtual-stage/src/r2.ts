import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

export async function uploadToR2(
  storageKey: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: storageKey,
    Body: data,
    ContentType: contentType,
  });

  await r2.send(command);

  return `${process.env.R2_PUBLIC_URL}/${storageKey}`;
}

export async function downloadFromR2(storageKey: string): Promise<Buffer> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: storageKey,
  });

  const response = await r2.send(command);
  const stream = response.Body as NodeJS.ReadableStream;

  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function getSignedDownloadUrl(
  storageKey: string,
  expiresIn: number = 3600
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: storageKey,
  });

  return getSignedUrl(r2, command, { expiresIn });
}
