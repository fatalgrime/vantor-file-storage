import { serveFile } from '../../../../../lib/server/content';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, props: { params: Promise<{ fileId: string }> }) {
  return serveFile(request, (await props.params).fileId);
}
