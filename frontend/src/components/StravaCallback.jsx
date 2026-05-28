import { useEffect } from 'react';
import { api } from '../api';

export default function StravaCallback({ onDone }) {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error || !code) {
      onDone(false, error || 'Geen code ontvangen');
      return;
    }

    api.stravaCallback(code)
      .then(data => {
        window.history.replaceState({}, '', '/');
        onDone(true, data.athlete);
      })
      .catch(err => onDone(false, err.message));
  }, []);

  return null;
}
