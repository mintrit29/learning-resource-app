/** Give explicit result opens their own iframe navigation, not a restored scroll visit. */
export function previewVisitUrl(src: string, pageUrl: string, visitId: string) {
  const page = new URL(pageUrl);
  const preview = new URL(src, page);
  if (preview.origin !== page.origin) throw new Error("Preview must stay in the app");
  preview.searchParams.set("visit", visitId);
  return preview.href;
}
