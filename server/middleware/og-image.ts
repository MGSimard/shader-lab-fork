export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname;

  // Match /og/:id.png (default state)
  const defaultMatch = path.match(/^\/og\/([^/]+)\.png$/);
  if (defaultMatch) {
    const id = defaultMatch[1];
    return proxyRequest(event, `/api/og/${id}/_`);
  }

  // Match /og/:id/:state.png (custom state)
  const stateMatch = path.match(/^\/og\/([^/]+)\/(.+)\.png$/);
  if (stateMatch) {
    const id = stateMatch[1];
    const state = stateMatch[2];
    return proxyRequest(event, `/api/og/${id}/${state}`);
  }
});
