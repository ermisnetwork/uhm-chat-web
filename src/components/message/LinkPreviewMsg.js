import React from 'react';
import LinkPreview from '@/components/LinkPreview';

const LinkPreviewMsg = React.memo(({ linkPreview }) => {
  return <LinkPreview linkPreview={linkPreview} />;
});
export default LinkPreviewMsg;
