import { Stack, Box, useTheme } from '@mui/material';
import ForwardTo from '@/components/message/ForwardTo';
import TextLine from '@/components/message/TextLine';
import MessageOption from '@/components/message/MessageOption';

const TextMsg = ({ message, forwardChannelName }) => {
  const theme = useTheme();

  return (
    <Stack direction="row" justifyContent={message.isMyMessage ? 'end' : 'start'} alignItems="center">
      <Box
        px={1.5}
        py={1.5}
        sx={{
          backgroundColor: message.isMyMessage ? theme.palette.primary.main : theme.palette.background.neutral,
          borderRadius: 1.5,
          position: 'relative',
          maxWidth: '100%',
        }}
      >
        <ForwardTo message={message} forwardChannelName={forwardChannelName} />
        <TextLine message={message} />
        <MessageOption isMyMessage={message.isMyMessage} message={message} />
      </Box>
    </Stack>
  );
};

export default TextMsg;
