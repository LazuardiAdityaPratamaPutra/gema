import { handle } from '@/server/router';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ path: string[] }> };
const make = (method: string) => async (req: Request, ctx: Ctx) =>
  handle(req, method, (await ctx.params).path);

export const GET = make('GET');
export const POST = make('POST');
export const PUT = make('PUT');
export const DELETE = make('DELETE');
