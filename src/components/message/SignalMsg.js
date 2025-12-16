import React from 'react';
import { Stack, Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import DateLine from './DateLine';
import { Phone, VideoCamera } from 'phosphor-react';
import { convertMessageSignal } from '../../utils/messageSignal';
import { CallType } from '../../constants/commons-const';
import UserMsgLayout from './UserMsgLayout';

const SignalMsg = React.memo(({ message, isLastInGroup }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const msg = convertMessageSignal(message.text, t);

  return (
    <UserMsgLayout message={message} isLastInGroup={isLastInGroup}>
      <Stack direction="row" alignItems="center">
        {msg?.callType === CallType.VIDEO ? (
          <VideoCamera size={22} weight="fill" color={msg.color ? msg.color : theme.palette.grey[500]} />
        ) : (
          <Phone size={22} weight="fill" color={msg.color ? msg.color : theme.palette.grey[500]} />
        )}
        <Typography
          variant="body2"
          color={message.isMyMessage ? '#fff' : theme.palette.text}
          sx={{ wordBreak: 'break-word', paddingLeft: '10px' }}
        >
          {t(msg?.text)}

          {msg?.duration && <span style={{ display: 'block', color: theme.palette.grey[500] }}>{msg?.duration}</span>}
        </Typography>
      </Stack>
      <DateLine date={message.created_at} isEdited={false} isMyMessage={message.isMyMessage} />
    </UserMsgLayout>
  );
});

export default SignalMsg;
