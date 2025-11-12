import { create } from 'zustand';

export type BreadcrumbItem = {
  path: string;
  label: string;
  parent?: string | null;
};

type NavigationState = {
  items: Record<string, BreadcrumbItem>;
  currentPath: string;
  order: string[];
  register: (item: BreadcrumbItem) => void;
  setActivePath: (path: string) => void;
};

const STORAGE_KEY = 'cc_nav_trail';

function loadInitial(): { items: Record<string, BreadcrumbItem>; order: string[] } {
  if (typeof sessionStorage === 'undefined') return { items: {}, order: [] };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: {}, order: [] };
    const parsed = JSON.parse(raw) as { items: Record<string, BreadcrumbItem>; order: string[] };
    return parsed;
  } catch {
    return { items: {}, order: [] };
  }
}

function persist(items: Record<string, BreadcrumbItem>, order: string[]) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ items, order }));
  } catch {
    // ignore quota issues
  }
}

export const useNavigationStore = create<NavigationState>((set, get) => {
  const initial = loadInitial();
  return {
    items: initial.items,
    order: initial.order,
    currentPath: initial.order.at(-1) || '/',
    register: (item) =>
      set((state) => {
        const items = { ...state.items, [item.path]: item };
        const exists = state.order.includes(item.path);
        const order = exists ? state.order : [...state.order, item.path];
        persist(items, order);
        return { items, order };
      }),
    setActivePath: (path) =>
      set((state) => {
        const updatedOrder = [...state.order.filter((entry) => entry !== path), path];
        persist(state.items, updatedOrder);
        return { currentPath: path, order: updatedOrder };
      }),
  };
});

export function getTrail(items: Record<string, BreadcrumbItem>, currentPath: string) {
  const trail: BreadcrumbItem[] = [];
  let cursor: string | undefined | null = currentPath;

  while (cursor) {
    const item = items[cursor];
    if (!item) break;
    trail.unshift(item);
    cursor = item.parent ?? null;
  }

  if (!trail.length && items['/']) trail.push(items['/']);
  return trail;
}
