import { Stack, Typography, useTheme } from '@mui/material';
import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { isChannelDirect } from '../../utils/commons';
import { client } from '../../client';
import { useTranslation } from 'react-i18next';
import { renderSystemMessage } from '../../utils/messageSystem';

const SystemMsg = React.memo(({ message, messages }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { currentChannel } = useSelector(state => state.channel);
  const users = client.state.users ? Object.values(client.state.users) : [];
  const isDirect = useMemo(() => isChannelDirect(currentChannel), [currentChannel]);

  const msgSystem = renderSystemMessage(message.text, users, isDirect, messages, t);

  return (
    <Stack direction="row" justifyContent="center">
      <Typography
        variant="body2"
        color={theme.palette.grey[500]}
        sx={{ textAlign: 'center', fontWeight: 400, order: 2, width: '100%' }}
        dangerouslySetInnerHTML={{ __html: msgSystem }}
      />
    </Stack>
  );
});

export default SystemMsg;
