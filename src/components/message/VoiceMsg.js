import React from 'react';
import { Stack } from '@mui/material';
import CustomAudioPlayer from '../CustomAudioPlayer';

const VoiceMsg = React.memo(({ voiceData, isMyMessage }) => {
  return (
    <Stack direction="row" alignItems="center" spacing={1} maxWidth={'100%'} width={'400px'}>
      <CustomAudioPlayer
        src={voiceData.asset_url}
        waveColor={isMyMessage ? '#fff' : '#0C0A29'}
        progressColor={isMyMessage ? '#0C0A29' : '#7949ec'}
      />
    </Stack>
  );
});
export default VoiceMsg;
