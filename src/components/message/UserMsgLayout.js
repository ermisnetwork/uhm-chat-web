import { Box, useTheme, Typography, Paper } from '@mui/material';
import MemberAvatar from '../MemberAvatar';
import ReactionsMessage from '../ReactionsMessage';
import MessageOption from './MessageOption';
import { MessageType } from '../../constants/commons-const';

const UserMsgLayout = ({ message, isLastInGroup, isHighlighted, children }) => {
  const theme = useTheme();
  const isMe = message.isMyMessage;
  const shouldShowAvatarAndName = !isMe && isLastInGroup;
  const mbValue = shouldShowAvatarAndName ? '30px' : '10px';
  const showMessageOption = [MessageType.Regular, MessageType.Sticker, MessageType.Poll].includes(message.type);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        mb: mbValue,
        px: 2,
        bgcolor: isHighlighted ? 'rgba(0, 132, 255, 0.3)' : 'transparent',
      }}
    >
      {shouldShowAvatarAndName && (
        <Box
          sx={{
            position: 'relative',
            cursor: 'pointer',
          }}
        >
          <MemberAvatar member={message.user} width={36} height={36} />
          <Typography
            variant="subtitle1"
            sx={{
              fontSize: '12px',
              fontWeight: 400,
              color: theme.palette.text.secondary,
              position: 'absolute',
              top: '100%',
              left: '0px',
              zIndex: 1,
              whiteSpace: 'nowrap',
              paddingTop: '5px',
            }}
          >
            {message.user.name}
          </Typography>
        </Box>
      )}

      <Box
        sx={{
          position: 'relative',
          maxWidth: '70%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isMe ? 'flex-end' : 'flex-start',
          ml: shouldShowAvatarAndName ? 0 : 5,
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: isMe ? theme.palette.primary.main : theme.palette.background.neutral,
            borderTopRightRadius: isMe ? 4 : 20,
            borderTopLeftRadius: isMe ? 20 : 4,
            opacity: message.status === 'sending' ? 0.5 : 1,
          }}
        >
          {children}
        </Paper>
        {showMessageOption && <MessageOption isMyMessage={isMe} message={message} />}
        <ReactionsMessage isMyMessage={isMe} message={message} />
      </Box>
    </Box>
  );
};

export default UserMsgLayout;
