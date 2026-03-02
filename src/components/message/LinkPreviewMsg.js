import React from 'react';
import LinkPreview from '../LinkPreview';

const LinkPreviewMsg = React.memo(({ linkPreview }) => {
  return <LinkPreview linkPreview={linkPreview} />;
});
export default LinkPreviewMsg;
