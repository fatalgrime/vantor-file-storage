import { ensureSchema, errorResponse, jsonBody, readState } from '../../../../../lib/server/store';
import { activeShare, checkShareCapacity, hasShareSession, openShare, sharePayload } from '../../../../../lib/server/shares';
const headers = { 'Cache-Control': 'private, no-store' };
export const dynamic = 'force-dynamic';
export async function GET(request: Request, props: { params: Promise<{ shareId: string }> }) {
  try {
    await ensureSchema();
    const { shareId } = await props.params;
    const { state } = await readState();
    const link = activeShare(state, shareId);
    if (!await hasShareSession(shareId)) {
      checkShareCapacity(link);
      return Response.json({ passwordRequired: Boolean(link.passwordHash), sessionRequired: true, label: link.label, itemType: link.itemType, oneTimeOnly: link.oneTimeOnly }, { headers });
    }
    return Response.json(sharePayload(state, shareId, new URL(request.url).searchParams.get('subfolderId') || undefined), { headers });
  } catch (error) { return errorResponse(error); }
}
export async function POST(request: Request, props: { params: Promise<{ shareId: string }> }) {
  try {
    await ensureSchema();
    const { shareId } = await props.params;
    const body = await jsonBody(request, 4096);
    await openShare(shareId, body.password);
    const { state } = await readState();
    return Response.json(sharePayload(state, shareId, typeof body.subfolderId === 'string' ? body.subfolderId : undefined), { headers });
  } catch (error) { return errorResponse(error); }
}
