import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isR2Configured, uploadToR2 } from '../../../../lib/r2';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isR2Configured()) {
    return NextResponse.json(
      { isR2: false, message: 'Cloudflare R2 is not configured. Falling back to primary storage.' },
      { status: 200 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const fileId = (formData.get('fileId') as string) || `file-${Date.now()}`;

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form data.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'application/octet-stream';

    const { url, r2Key } = await uploadToR2(fileId, file.name, buffer, mimeType);

    return NextResponse.json({
      isR2: true,
      url,
      r2Key,
      fileId,
      size: file.size,
    });
  } catch (error) {
    console.error('Cloudflare R2 Upload Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload file to Cloudflare R2.' },
      { status: 500 }
    );
  }
}
