export function GET() {
  return Response.json(
    { status: "ok", service: "blakcert-web", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
