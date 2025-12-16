import { Stack } from '@mui/material';
import React from 'react';
import ImageCanvas from '../ImageCanvas';
import UserMsgLayout from './UserMsgLayout';

const StickerMsg = React.memo(({ message, isLastInGroup, isHighlighted }) => {
  return (
    <UserMsgLayout message={message} isLastInGroup={isLastInGroup} isHighlighted={isHighlighted}>
      <Stack direction="column" alignItems="flex-end" width={'200px'} justifyContent="center">
        {message.sticker_url.endsWith('.tgs') ? (
          <tgs-player
            autoplay
            loop
            mode="normal"
            src={message.sticker_url}
            style={{ width: '200px', height: '200px' }}
          ></tgs-player>
        ) : (
          <ImageCanvas
            dataUrl={message.sticker_url}
            width={'200px'}
            height={'200px'}
            styleCustom={{ borderRadius: '12px' }}
            openLightbox={true}
          />
        )}
      </Stack>
    </UserMsgLayout>
  );
});

export default StickerMsg;
