import { getTrail, useNavigationStore } from '../../store/navigation';
import { ViewTransitionLink } from './ViewTransitionLink';

export default function Breadcrumbs() {
  const items = useNavigationStore((state) => state.items);
  const currentPath = useNavigationStore((state) => state.currentPath);
  const trail = getTrail(items, currentPath);

  if (!trail.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500 flex items-center flex-wrap gap-1">
      {trail.map((item, index) => {
        const isLast = index === trail.length - 1;
        const Component = isLast ? 'span' : ViewTransitionLink;
        return (
          <div key={item.path} className="flex items-center gap-1">
            {index > 0 && <span aria-hidden="true">/</span>}
            {isLast ? (
              <span className="font-medium text-gray-700" aria-current="page">
                {item.label}
              </span>
            ) : (
              <Component to={item.path} className="text-rose-600 hover:underline font-medium">
                {item.label}
              </Component>
            )}
          </div>
        );
      })}
    </nav>
  );
}
