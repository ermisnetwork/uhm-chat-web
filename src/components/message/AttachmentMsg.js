import React from 'react';
import { Stack, Box } from '@mui/material';
import Attachments from '../../components/Attachments';
import VoiceLine from './VoiceLine';

const AttachmentMsg = ({ message }) => {
  const attachments = message.attachments.filter(
    attachment => !['linkPreview', 'voiceRecording'].includes(attachment.type),
  );
  const voiceMsg = message.attachments.find(attachment => attachment.type === 'voiceRecording');

  return (
    <Box
      sx={{
        position: 'relative',
        maxWidth: attachments.length === 1 ? '20rem' : '30rem',
        mb: 0.5,
      }}
    >
      <Stack spacing={1}>
        <Attachments attachments={attachments} />
        <VoiceLine voiceMsg={voiceMsg} isMyMessage={message.isMyMessage} />
      </Stack>
    </Box>
  );
};
export default AttachmentMsg;
