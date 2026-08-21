import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getR2DownloadUrl, isR2Configured } from '../../../../../lib/r2';

export async function GET(
  request: Request,
  props: { params: Promise<{ fileId: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = await props.params;
  const { searchParams } = new URL(request.url);
  const r2Key = searchParams.get('r2Key');

  if (!r2Key) {
    return NextResponse.json({ error: 'Missing r2Key parameter' }, { status: 400 });
  }

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'Cloudflare R2 storage is not configured.' }, { status: 400 });
  }

  try {
    const downloadUrl = await getR2DownloadUrl(r2Key);
    return NextResponse.json({ url: downloadUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
