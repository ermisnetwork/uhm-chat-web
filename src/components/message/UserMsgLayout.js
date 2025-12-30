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
  const isMsgLinkPreview = message.attachments?.[0]?.type === 'linkPreview';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        pb: mbValue,
        px: 2,
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '50%',
          width: '200%',
          height: '100%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(0, 132, 255, 0.3)',
          display: isHighlighted ? 'block' : 'none',
        },
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
            maxWidth: isMsgLinkPreview ? '400px' : '100%',
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
