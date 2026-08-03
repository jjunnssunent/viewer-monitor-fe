const BACKEND_API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://dev-sp-api.jjunnssun.com").replace(/\/$/, "");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxyRequest(request: Request, context: RouteContext) {
  if (!/^https:\/\//.test(BACKEND_API_URL)) {
    return Response.json({ message: "운영 백엔드 API 주소가 올바르지 않습니다." }, { status: 500 });
  }

  const { path } = await context.params;
  const sourceUrl = new URL(request.url);
  const targetUrl = new URL(`${BACKEND_API_URL}/${path.map(encodeURIComponent).join("/")}`);
  targetUrl.search = sourceUrl.search;

  const requestHeaders = new Headers(request.headers);
  for (const header of ["host", "connection", "content-length", "origin", "referer", "accept-encoding"]) {
    requestHeaders.delete(header);
  }

  const method = request.method.toUpperCase();
  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: requestHeaders,
      body: method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return Response.json({ message: "백엔드 서버에 연결할 수 없습니다." }, {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("set-cookie");
  responseHeaders.set("cache-control", "no-store");

  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", toFirstPartyCookie(cookie));
  }

  return new Response(method === "HEAD" ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

function toFirstPartyCookie(cookie: string) {
  const withoutDomainAndPath = cookie
    .replace(/;\s*Domain=[^;]*/gi, "")
    .replace(/;\s*Path=[^;]*/gi, "");
  return `${withoutDomainAndPath}; Path=/`;
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
