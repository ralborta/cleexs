const STORAGE_KEY = 'cleexs_visitor_id';

export function getOrCreateCleexsVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let v = localStorage.getItem(STORAGE_KEY);
    if (!v || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
      v = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, v);
    }
    return v;
  } catch {
    return crypto.randomUUID();
  }
}
