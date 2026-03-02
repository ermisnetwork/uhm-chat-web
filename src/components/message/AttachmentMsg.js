import React from 'react';
import Attachments from '@/components/Attachments';

const AttachmentMsg = React.memo(({ attachments }) => {
  return <Attachments attachments={attachments} />;
});

export default AttachmentMsg;
