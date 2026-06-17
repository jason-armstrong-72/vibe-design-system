import { resolve } from "node:path";
import { applyEdit } from "@/lib/editor/apply-edit";
import type { Theme } from "@/lib/tokens/types";

const globalsPath = () => process.env.DS_GLOBALS_PATH ?? resolve("app/globals.css");

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  let body: { token?: string; value?: string; theme?: Theme };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const { token, value, theme } = body;
  if (!token || value === undefined || (theme !== "light" && theme !== "dark")) {
    return Response.json({ error: "token, value, theme required" }, { status: 400 });
  }
  try {
    await applyEdit(globalsPath(), { name: token, value, theme });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
