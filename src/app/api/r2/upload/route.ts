import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';
import { isR2Configured, uploadToR2 } from '../../../../lib/r2';

const getDb = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }
  return neon(connectionString);
};

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  let file: File | null = null;
  let fileId = `file-${Date.now()}`;

  try {
    formData = await request.formData();
    file = formData.get('file') as File | null;
    fileId = (formData.get('fileId') as string) || fileId;
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 });
  }

  if (!file) {
    return NextResponse.json({ error: 'No file provided in form data.' }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const mimeType = file.type || 'application/octet-stream';

  // 1. Try Cloudflare R2 if configured
  if (isR2Configured()) {
    try {
      const { url, r2Key } = await uploadToR2(fileId, file.name, buffer, mimeType);
      return NextResponse.json({
        isR2: true,
        url,
        r2Key,
        fileId,
        size: file.size,
      });
    } catch (r2Error) {
      console.warn('R2 upload failed, falling back to database blob storage:', r2Error);
    }
  }

  // 2. Database Blob Storage Fallback (Neon PostgreSQL)
  try {
    const sql = getDb();
    
    await sql`
      CREATE TABLE IF NOT EXISTS vantor_file_blobs (
        file_id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const hexData = `\\x${buffer.toString('hex')}`;

    await sql`
      INSERT INTO vantor_file_blobs (file_id, filename, mime_type, data)
      VALUES (${fileId}, ${file.name}, ${mimeType}, ${hexData}::bytea)
      ON CONFLICT (file_id) DO UPDATE SET
        filename = EXCLUDED.filename,
        mime_type = EXCLUDED.mime_type,
        data = EXCLUDED.data,
        created_at = NOW()
    `;

    const fallbackUrl = `/api/public/files/${fileId}`;

    return NextResponse.json({
      isR2: false,
      url: fallbackUrl,
      fileId,
      size: file.size,
    });
  } catch (dbError) {
    console.error('Database blob storage error:', dbError);
    return NextResponse.json(
      { error: dbError instanceof Error ? dbError.message : 'Failed to store file blob in database.' },
      { status: 500 }
    );
  }
}
