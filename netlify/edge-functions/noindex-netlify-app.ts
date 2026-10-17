// Adds `X-Robots-Tag: noindex, nofollow` only when the request host is a *.netlify.app preview
// (production deploys, deploy previews, branch deploys). Custom domains pass through untouched.
export default async (request: Request, context: { next: () => Promise<Response> }) => {
  const host = new URL(request.url).hostname;
  const response = await context.next();
  if (host.endsWith('.netlify.app')) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
};
