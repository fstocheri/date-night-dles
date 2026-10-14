// Deezer's API doesn't send CORS headers, but it supports JSONP, which works from a static page.

export interface DeezerTrack {
  id: number;
  title: string;
  preview: string; // 30-second MP3; the URL carries a token that expires
  album: { title: string; cover_xl: string };
  artist: { name: string };
}

let counter = 0;

function jsonp<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const callback = `__deezer${Date.now()}_${counter++}`;
    const script = document.createElement('script');
    const w = window as unknown as Record<string, unknown>;
    const cleanup = () => {
      delete w[callback];
      script.remove();
    };
    w[callback] = (data: T & { error?: { message: string } }) => {
      cleanup();
      if (data?.error) reject(new Error(data.error.message));
      else resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('Could not reach Deezer'));
    };
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${callback}`;
    document.head.appendChild(script);
  });
}

export const fetchTrack = (id: string) => jsonp<DeezerTrack>(`https://api.deezer.com/track/${encodeURIComponent(id)}`);
