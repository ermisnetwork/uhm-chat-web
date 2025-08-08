import React, { useEffect, useState } from 'react';
import { Badge, Box, Stack, Typography } from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { AddUnreadChannel, RemoveUnreadChannel, UpdateUnreadChannel } from '../redux/slices/channel';
import ChannelAvatar from './ChannelAvatar';
import { ClientEvents } from '../constants/events-const';
import { onEditMessage, onReplyMessage } from '../redux/slices/messages';
import { Play, PushPin } from 'phosphor-react';
import { AvatarShape, MessageType } from '../constants/commons-const';
import { convertMessageSystem } from '../utils/messageSystem';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PATH } from '../config';
import { convertMessageSignal } from '../utils/messageSignal';
import { getDisplayDate } from '../utils/formatTime';
import { client } from '../client';
import TopicAvatar from './TopicAvatar';

const StyledTopicItem = styled(Box)(({ theme }) => ({
  width: '100%',
  borderRadius: '16px',
  position: 'relative',
  transition: 'background-color 0.2s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  padding: '6px',
  '&:hover': {
    cursor: 'pointer',
    backgroundColor: theme.palette.divider,
  },
}));

const TopicElement = ({ topic }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentChannel, unreadChannels } = useSelector(state => state.channel);
  const { user_id } = useSelector(state => state.auth);
  const users = client.state.users ? Object.values(client.state.users) : [];
  const channelId = topic?.id || '';
  const channelType = topic?.type || '';
  const isPinned = topic.data?.is_pinned;

  const [lastMessage, setLastMessage] = useState('');
  const [count, setCount] = useState(0);
  const [lastMessageAt, setLastMessageAt] = useState('');

  const replaceMentionsWithNames = inputValue => {
    users.forEach(user => {
      inputValue = inputValue.replaceAll(`@${user.id}`, `@${user.name}`);
    });
    return inputValue;
  };

  const getLastMessage = message => {
    if (message) {
      const date = message.updated_at ? message.updated_at : message.created_at;
      const sender = message.user;
      const senderId = sender?.id;
      const isMe = user_id === senderId;
      const senderName = isMe ? 'You' : sender?.name || senderId;
      setLastMessageAt(getDisplayDate(date));
      if (message.type === MessageType.System) {
        const messageSystem = convertMessageSystem(message.text, users, false);
        setLastMessage(`${senderName}: ${messageSystem}`);
      } else if (message.type === MessageType.Signal) {
        const messageSignal = convertMessageSignal(message.text);
        setLastMessage(messageSignal.text || '');
      } else if (message.type === MessageType.Sticker) {
        setLastMessage(`${senderName}: Sticker`);
      } else {
        if (message.attachments) {
          const attachmentLast = message.attachments[message.attachments.length - 1];

          const isLinkPreview = attachmentLast.type === 'linkPreview';
          const isImage = attachmentLast.type === 'image';
          const isVideo = attachmentLast.type === 'video';

          if (isImage) {
            setLastMessage(
              <>
                {`${senderName}:`}
                <img
                  src={attachmentLast.image_url}
                  alt={attachmentLast.title || 'image'}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '5px',
                    display: 'inline-block',
                    verticalAlign: 'top',
                    margin: '0px 4px',
                  }}
                />
                {attachmentLast.title || 'Photo'}
              </>,
            );
          } else if (isVideo) {
            setLastMessage(
              <>
                {`${senderName}:`}
                <span style={{ position: 'relative', display: 'inline-block', margin: '0px 4px' }}>
                  <img
                    src={attachmentLast.thumb_url}
                    alt={attachmentLast.title || 'video'}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '5px',
                      display: 'inline-block',
                      verticalAlign: 'top',
                    }}
                  />
                  <Play
                    size={10}
                    color="#fff"
                    weight="fill"
                    style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                  />
                </span>
                {attachmentLast.title || 'Video'}
              </>,
            );
          } else {
            setLastMessage(`${senderName}: ${isLinkPreview ? attachmentLast.link_url : attachmentLast.title}`);
          }
        } else {
          const messagePreview = replaceMentionsWithNames(message.text);
          setLastMessage(`${senderName}: ${messagePreview}`);
        }
      }
    } else {
      setLastMessageAt(getDisplayDate(topic.data.created_at));
      setLastMessage('No messages here yet');
    }
  };

  useEffect(() => {
    const lastMsg = topic.state.messages.length > 0 ? topic.state.messages[topic.state.messages.length - 1] : null;
    getLastMessage(lastMsg);

    setCount(topic.state.unreadCount);

    const handleMessageNew = event => {
      if (event.channel_id === topic.data.id) {
        setCount(event.unread_count);

        if (!(event.message.type === MessageType.Signal && ['1', '4'].includes(event.message.text[0]))) {
          // không cần hiển thị last message với AudioCallStarted (1) hoặc VideoCallStarted (4) khi có cuộc gọi
          getLastMessage(event.message);
        }

        if (event.user.id !== user_id && unreadChannels) {
          const existingChannel = unreadChannels.find(item => item.id === event.channel_id);
          dispatch(
            existingChannel && event.unread_count > 0
              ? UpdateUnreadChannel(event.channel_id, event.unread_count, event.channel_type)
              : AddUnreadChannel(event.channel_id, event.unread_count, event.channel_type),
          );
        }
      }
    };

    const handleMessageUpdated = event => {
      if (event.channel_id === topic.data.id) {
        const lastMsg = topic.state.messages.length > 0 ? topic.state.messages[topic.state.messages.length - 1] : null;
        getLastMessage(lastMsg);
      }
    };

    const handleMessageDeleted = event => {
      if (event.channel_id === topic.data.id) {
        const lastMsg = topic.state.messages.length > 0 ? topic.state.messages[topic.state.messages.length - 1] : null;
        getLastMessage(lastMsg);
      }
    };

    const handleMessageRead = event => {
      if (event.user.id === user_id && event.channel_id === topic.data.id) {
        setCount(0);

        if (unreadChannels.some(item => item.id === event.channel_id)) {
          dispatch(RemoveUnreadChannel(event.channel_id));
        }
      }
    };

    client.on(ClientEvents.MessageNew, handleMessageNew);
    client.on(ClientEvents.MessageUpdated, handleMessageUpdated);
    client.on(ClientEvents.MessageDeleted, handleMessageDeleted);
    client.on(ClientEvents.MessageRead, handleMessageRead);
    return () => {
      client.off(ClientEvents.MessageNew, handleMessageNew);
      client.off(ClientEvents.MessageUpdated, handleMessageUpdated);
      client.off(ClientEvents.MessageDeleted, handleMessageDeleted);
      client.off(ClientEvents.MessageRead, handleMessageRead);
    };
  }, [topic, user_id, users.length, unreadChannels]);

  const onLeftClick = () => {
    if (currentChannel?.id !== channelId) {
      navigate(`${DEFAULT_PATH}/${channelType}:${channelId}`);
      dispatch(onReplyMessage(null));
      dispatch(onEditMessage(null));
    }
  };

  const isSelectedChannel = currentChannel?.id === channelId;

  return (
    <>
      <StyledTopicItem
        onClick={onLeftClick}
        sx={
          {
            // backgroundColor: isSelectedChannel ? `${alpha(theme.palette.primary.main, 0.2)} !important` : 'transparent',
          }
        }
        gap={1}
      >
        {/* -------------------------------avatar------------------------------- */}
        <TopicAvatar url={topic.data?.image || ''} name={topic.data?.name || ''} size={40} shape={AvatarShape.Round} />

        {/* -------------------------------content------------------------------- */}
        <Box sx={{ flex: 1, minWidth: 'auto', overflow: 'hidden' }}>
          {/* -------------------------------topic name------------------------------- */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography
              variant="subtitle2"
              sx={{
                flex: 1,
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: '14px',
              }}
            >
              {topic.data.name}
            </Typography>

            <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={1}>
              {isPinned && <PushPin size={14} color={theme.palette.primary.main} weight="fill" />}

              <Typography
                sx={{
                  color: theme.palette.text.secondary,
                  minWidth: 'auto',
                  flex: 1,
                  overflow: 'hidden',
                  fontSize: '10px',
                }}
                variant="caption"
              >
                {lastMessageAt}
              </Typography>
            </Stack>
          </Stack>

          {/* -------------------------------last message------------------------------- */}
          <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography
              variant="caption"
              sx={{
                color: count > 0 ? 'inherit' : theme.palette.text.secondary,
                flex: 1,
                minWidth: 'auto',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: '14px',
                display: 'block',
                fontWeight: count > 0 ? 600 : 400,
              }}
            >
              {lastMessage}
            </Typography>

            {count > 0 ? <Badge variant="dot" color="error" sx={{ margin: '0 10px 0 15px' }} /> : null}
          </Stack>
        </Box>
      </StyledTopicItem>
    </>
  );
};

export default TopicElement;
