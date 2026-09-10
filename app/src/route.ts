/**
 * Two views, one hand-rolled switch. A router earns its place at more routes than this.
 * `app/nginx.conf` falls back to `index.html`, so a deep link to `/about` serves the app.
 */
import { useEffect, useState } from 'react';

export type Route = 'dashboard' | 'about';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

export function routeFromPath(pathname: string): Route {
  const rel = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  return rel.replace(/\/+$/, '') === '/about' ? 'about' : 'dashboard';
}

export function hrefFor(route: Route): string {
  return route === 'about' ? `${BASE}/about` : `${BASE}/`;
}

export function useRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => routeFromPath(window.location.pathname));
  useEffect(() => {
    const onPop = () => setRoute(routeFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (r: Route) => {
    if (r === route) return;
    window.history.pushState(null, '', hrefFor(r));
    window.scrollTo(0, 0);
    setRoute(r);
  };
  return [route, navigate];
}
