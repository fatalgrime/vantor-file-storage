import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const getDb = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is missing.');
  }
  return neon(connectionString);
};

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  props: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await props.params;

  if (!fileId) {
    return NextResponse.json({ error: 'Missing fileId parameter' }, { status: 400 });
  }

  try {
    const sql = getDb();

    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS vantor_file_blobs (
        file_id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        data BYTEA NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const rows = await sql`
      SELECT filename, mime_type, data
      FROM vantor_file_blobs
      WHERE file_id = ${fileId}
      LIMIT 1
    `;

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'File blob not found.' }, { status: 404 });
    }

    const fileRecord = rows[0];
    const mimeType = fileRecord.mime_type || 'application/octet-stream';
    const filename = fileRecord.filename || 'file';

    let buffer: Buffer;
    if (Buffer.isBuffer(fileRecord.data)) {
      buffer = fileRecord.data;
    } else if (typeof fileRecord.data === 'string') {
      const hexString = fileRecord.data.startsWith('\\x') ? fileRecord.data.slice(2) : fileRecord.data;
      buffer = Buffer.from(hexString, 'hex');
    } else {
      buffer = Buffer.from(fileRecord.data);
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('File blob retrieval error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retrieve file blob.' },
      { status: 500 }
    );
  }
}
