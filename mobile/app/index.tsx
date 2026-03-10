import { Redirect, type Href } from 'expo-router';
import React, { useEffect, useState } from 'react';

import { consumePendingRouteResume } from '../src/services/routeResume';

function buildRedirectHref(target: Awaited<ReturnType<typeof consumePendingRouteResume>>): Href {
  if (!target) {
    return '/(tabs)/calendar';
  }

  return target.params
    ? ({
        pathname: target.pathname,
        params: target.params,
      } as Href)
    : target.pathname;
}

export default function IndexRoute() {
  const [href, setHref] = useState<Href | null>(null);

  useEffect(() => {
    let cancelled = false;

    void consumePendingRouteResume().then((pendingRoute) => {
      if (cancelled) {
        return;
      }

      setHref(buildRedirectHref(pendingRoute));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return href ? <Redirect href={href} /> : null;
}
