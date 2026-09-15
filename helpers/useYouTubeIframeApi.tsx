import { useState, useEffect } from 'react';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const useYouTubeIframeApi = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.YT && window.YT.Player) {
      setIsReady(true);
      return;
    }

    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.id = 'youtube-iframe-api';
      document.body.appendChild(script);
    }

    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevOnReady) prevOnReady();
      setIsReady(true);
    };

    // We do not remove the script on unmount as other components might need it
  }, []);

  return isReady;
};