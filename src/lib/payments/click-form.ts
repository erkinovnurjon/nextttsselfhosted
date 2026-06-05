// Click form-urlencoded (yoki JSON) so'rovini ClickParams obyektiga aylantiradi.
export async function parseClickForm(request: Request): Promise<Record<string, string>> {
  const ct = request.headers.get("content-type") || "";
  const out: Record<string, string> = {};
  if (ct.includes("application/json")) {
    const j = await request.json().catch(() => ({}));
    for (const [k, v] of Object.entries(j ?? {})) out[k] = String(v);
    return out;
  }
  // form-urlencoded yoki multipart
  const form = await request.formData().catch(() => null);
  if (form) {
    for (const [k, v] of form.entries()) out[k] = String(v);
  }
  return out;
}
