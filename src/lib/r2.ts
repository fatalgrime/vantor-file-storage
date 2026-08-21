import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'vantor-file-storage';
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN;

export const isR2Configured = (): boolean => {
  return Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY);
};

export const getR2Client = (): S3Client => {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 storage environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) are missing.');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });
};

export const uploadToR2 = async (
  fileId: string,
  fileName: string,
  data: Buffer | Uint8Array,
  mimeType: string
): Promise<{ url: string; r2Key: string }> => {
  const s3 = getR2Client();
  const cleanFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const r2Key = `files/${fileId}/${cleanFileName}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
    Body: data,
    ContentType: mimeType,
  });

  await s3.send(command);

  let url = '';
  if (R2_PUBLIC_DOMAIN) {
    const domain = R2_PUBLIC_DOMAIN.endsWith('/') ? R2_PUBLIC_DOMAIN.slice(0, -1) : R2_PUBLIC_DOMAIN;
    url = `${domain}/${r2Key}`;
  } else {
    // Generate 7-day presigned download URL
    const getCommand = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
    });
    url = await getSignedUrl(s3, getCommand, { expiresIn: 604800 });
  }

  return { url, r2Key };
};

export const deleteFromR2 = async (r2Key: string): Promise<boolean> => {
  if (!isR2Configured() || !r2Key) return false;

  try {
    const s3 = getR2Client();
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2Key,
    });
    await s3.send(command);
    return true;
  } catch (error) {
    console.error('Failed to delete object from Cloudflare R2:', error);
    return false;
  }
};

export const getR2DownloadUrl = async (r2Key: string): Promise<string> => {
  if (!r2Key) return '';
  if (R2_PUBLIC_DOMAIN) {
    const domain = R2_PUBLIC_DOMAIN.endsWith('/') ? R2_PUBLIC_DOMAIN.slice(0, -1) : R2_PUBLIC_DOMAIN;
    return `${domain}/${r2Key}`;
  }

  const s3 = getR2Client();
  const getCommand = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: r2Key,
  });
  return getSignedUrl(s3, getCommand, { expiresIn: 3600 });
};
