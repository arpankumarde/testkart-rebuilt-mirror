// The mobile app signs requests with a bearer token and still opens some files from the storage links that
// shared endpoints return. The web signs in with the session cookie and reads documents as rendered pages
// (endpoints/reader), so those links are left out of web responses.
export const isBearerRequest = (request: Request): boolean =>
  request.headers.get("authorization")?.toLowerCase().startsWith("bearer ") ?? false;