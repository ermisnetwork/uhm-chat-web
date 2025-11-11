import { useEffect } from 'react';
import * as LibAVWebCodecs from 'libavjs-webcodecs-polyfill';

export const useLibAV = () => {
  useEffect(() => {
    const init = async () => {
      try {
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
          import LibAV from '/libav.js/dist/libav-6.8.8.0-default.mjs';
          window.LibAV = LibAV;
          window.dispatchEvent(new Event('libav-loaded'));
        `;
        document.head.appendChild(script);

        await new Promise(resolve => {
          window.addEventListener('libav-loaded', resolve, { once: true });
        });

        if (!window.LibAV) {
          throw new Error('Failed to load LibAV library.');
        }

        await LibAVWebCodecs.load({
          polyfill: true,
          LibAV: window.LibAV,
          libavOptions: {
            noworker: true,
          },
        });
      } catch (err) {
        console.error('LibAV initialization error:', err);
      }
    };

    init();
  }, []);

  return { LibAVWebCodecs };
};
