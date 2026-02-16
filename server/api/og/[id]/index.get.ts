// Redirect /api/og/:id to render with default state
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id") || "gradient-dither";
  return sendRedirect(event, `/api/og/${id}/_`, 302);
});
