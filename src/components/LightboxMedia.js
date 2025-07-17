import React from 'react';
import Lightbox from 'yet-another-react-lightbox';
import Video from 'yet-another-react-lightbox/plugins/video';
import Thumbnails from 'yet-another-react-lightbox/plugins/thumbnails';
import Fullscreen from 'yet-another-react-lightbox/plugins/fullscreen';
import Download from 'yet-another-react-lightbox/plugins/download';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import Captions from 'yet-another-react-lightbox/plugins/captions';

const LightboxMedia = ({ openLightbox, setOpenlightbox, medias, indexMedia }) => {
  return (
    <Lightbox
      open={openLightbox}
      close={() => setOpenlightbox(false)}
      slides={medias}
      index={indexMedia}
      plugins={[Video, Thumbnails, Fullscreen, Download, Zoom, Captions]}
      captions={{ descriptionTextAlign: 'center' }}
      // on={{
      //   view: ({ index }) => setIndexMedia(index),
      // }}
    />
  );
};

export default LightboxMedia;
