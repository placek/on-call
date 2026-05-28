import { useState, useEffect } from 'react';

// Tracks whether the viewport is narrow enough that we should switch to
// compact mobile variants of the UI. Single shared breakpoint at 640px.
export function useIsNarrow(breakpoint = 640) {
  const [narrow, setNarrow] = useState(
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setNarrow(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return narrow;
}
