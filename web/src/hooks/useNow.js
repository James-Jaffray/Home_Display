import { useEffect, useState } from 'react';

/**
 * The current time, re-rendered every second.
 * @returns {Date}
 */
export default function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return now;
}
