import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Badge, Box, Stack, Typography, Menu, MenuItem, Tooltip } from '@mui/material';
import { styled, useTheme, alpha } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import {
  AddUnreadChannel,
  RemoveUnreadChannel,
  SetMarkReadChannel,
  UpdateUnreadChannel,
} from '../redux/slices/channel';
import ChannelAvatar from './ChannelAvatar';
import { isChannelDirect, myRoleInChannel } from '../utils/commons';
import { ClientEvents } from '../constants/events-const';
import { onEditMessage, onReplyMessage } from '../redux/slices/messages';
import { Play, PushPin, PushPinSlash, SignOut, Trash } from 'phosphor-react';
import { AvatarShape, ChatType, ConfirmType, MessageType, RoleMember } from '../constants/commons-const';
import { setChannelConfirm } from '../redux/slices/dialog';
import { convertMessageSystem } from '../utils/messageSystem';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PATH } from '../config';
import { convertMessageSignal } from '../utils/messageSignal';
import { getDisplayDate } from '../utils/formatTime';
import { client } from '../client';
import { SpearkerOffIcon } from './Icons';
import AvatarGeneralDefault from './AvatarGeneralDefault';
import TopicAvatar from './TopicAvatar';
import { SetOpenTopicPanel } from '../redux/slices/topic';

const StyledChatBox = styled(Box)(({ theme }) => ({
  // width: '100%',
  borderRadius: '16px',
  position: 'relative',
  transition: 'all 0.2s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  '&:hover': {
    cursor: 'pointer',
    backgroundColor: theme.palette.divider,
    '& .optionsMore': {
      display: 'flex',
      justifyContent: 'flex-end',
    },
    '& .optionsNoti': {
      display: 'none',
    },
  },
}));

const StyledMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    color: theme.palette.mode === 'light' ? 'rgb(55, 65, 81)' : theme.palette.grey[300],
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
    '& .MuiMenuItem-root': {
      '& svg': {
        marginRight: '10px',
        width: '18px',
        height: '18px',
        fill: theme.palette.text.secondary,
      },
    },
  },
}));

const ListTopic = ({ topics }) => {
  const theme = useTheme();
  const maxTopics = 2; // Số topic tối đa hiển thị

  const visibleTopics = topics.slice(0, maxTopics);
  const hasMore = topics.length > maxTopics;

  return (
    <Stack direction="row" alignItems="center" gap={2}>
      <Stack direction="row" alignItems="center">
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.primary,
            fontSize: '12px',
            fontWeight: 400,
          }}
        >
          General&nbsp;
        </Typography>
        <AvatarGeneralDefault size={16} />
      </Stack>

      {visibleTopics.map(topic => {
        return (
          <Stack key={topic.id} direction="row" alignItems="center" sx={{ maxWidth: 120, minWidth: 0 }}>
            <Typography
              variant="caption"
              noWrap
              sx={{
                color: theme.palette.text.primary,
                fontSize: '12px',
                fontWeight: 400,
                maxWidth: 70,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {topic.data.name}&nbsp;
            </Typography>
            <TopicAvatar
              url={topic.data?.image || ''}
              name={topic.data?.name || ''}
              size={20}
              shape={AvatarShape.Round}
            />
          </Stack>
        );
      })}

      {hasMore && (
        <Typography
          variant="caption"
          sx={{
            color: theme.palette.text.secondary,
            fontSize: '16px',
            fontWeight: 600,
          }}
        >
          ...
        </Typography>
      )}
    </Stack>
  );
};

const ChatElement = ({ channel }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentChannel, mutedChannels, unreadChannels } = useSelector(state => state.channel);
  const { openTopicPanel } = useSelector(state => state.topic);
  const { user_id } = useSelector(state => state.auth);
  const users = client.state.users ? Object.values(client.state.users) : [];
  const channelId = channel?.id || '';
  const channelType = channel?.type || '';
  const isDirect = isChannelDirect(channel);
  const myRole = myRoleInChannel(channel);
  const isPinned = channel.data.is_pinned;

  const [lastMessage, setLastMessage] = useState('');
  const [anchorEl, setAnchorEl] = useState(null);
  const openMenu = Boolean(anchorEl);
  const [isRightClick, setIsRightClick] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [lastMessageAt, setLastMessageAt] = useState('');

  const showItemLeaveChannel = !isDirect && [RoleMember.MOD, RoleMember.MEMBER].includes(myRole);
  const showItemDeleteChannel = !isDirect && [RoleMember.OWNER].includes(myRole);
  const showItemDeleteConversation = isDirect;
  const showItemMarkAsRead =
    unreadChannels && unreadChannels.some(item => item.id === channelId && item.unreadCount > 0);
  const isMuted = mutedChannels.some(channel => channel.id === channelId);
  const isEnabledTopics = channel.data?.topics_enabled;
  const topics = channel.state?.topics ? channel.state?.topics : [];
  const hasUnread = unreadChannels && unreadChannels.some(item => item.id === channelId);
  const isCurrentChannelEnabledTopic = currentChannel?.data?.topics_enabled;

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
        const messageSystem = convertMessageSystem(message.text, users, isDirect);
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
      setLastMessageAt(getDisplayDate(channel.data.created_at));
      setLastMessage('No messages here yet');
    }
  };

  // Hàm tối ưu để tìm tin nhắn mới nhất
  const getOptimizedLastMessage = useCallback(channel => {
    const channelMessages = channel.state.messages || [];
    const channelLastMsg = channelMessages.length > 0 ? channelMessages[channelMessages.length - 1] : null;

    // Nếu không phải TEAM channel hoặc không có topics
    if (channel.type !== ChatType.TEAM || !channel.data.topics_enabled || !channel.state?.topics) {
      return channelLastMsg;
    }

    const topics = channel.state.topics;
    if (topics.length === 0) {
      return channelLastMsg;
    }

    // Tìm tin nhắn mới nhất từ topics
    let latestTopicMessage = null;
    let latestTopicTimestamp = 0;

    for (const topic of topics) {
      const topicMessages = topic.state?.messages;
      if (topicMessages && topicMessages.length > 0) {
        const topicLastMessage = topicMessages[topicMessages.length - 1];
        const messageTimestamp = new Date(topicLastMessage.updated_at || topicLastMessage.created_at).getTime();

        if (messageTimestamp > latestTopicTimestamp) {
          latestTopicMessage = topicLastMessage;
          latestTopicTimestamp = messageTimestamp;
        }
      }
    }

    // So sánh giữa channel và topic để chọn tin nhắn mới nhất
    if (!latestTopicMessage) return channelLastMsg;
    if (!channelLastMsg) return latestTopicMessage;

    const channelTimestamp = new Date(channelLastMsg.updated_at || channelLastMsg.created_at).getTime();
    return latestTopicTimestamp > channelTimestamp ? latestTopicMessage : channelLastMsg;
  }, []);

  // Memoize tin nhắn cuối cùng để tránh tính toán lại không cần thiết
  const optimizedLastMessage = useMemo(() => {
    return getOptimizedLastMessage(channel);
  }, [channel.state.messages, channel.state?.topics, getOptimizedLastMessage, channel]);

  useEffect(() => {
    getLastMessage(optimizedLastMessage);

    const membership = channel.state.membership;
    const blocked = membership?.blocked ?? false;
    setIsBlocked(blocked);

    const handleMessageNew = event => {
      const isCurrentChannel = event.channel_id === channel.data.id;
      // Kiểm tra parent_cid để xác định message có phải từ topic trong channel này không
      const isTopicInChannel = event?.parent_cid === channel.cid;

      if (event.user.id !== user_id) {
        if (isTopicInChannel) {
          // Là topic
          const existingChannel = unreadChannels && unreadChannels.find(item => item.id === channel.data.id);
          const existingTopic = existingChannel && existingChannel.unreadTopics.find(t => t.id === event.channel_id);

          if (existingTopic) {
            // Cập nhật số lượng tin nhắn chưa đọc cho topic
            const topic = {
              ...existingTopic,
              unreadCount: event.unread_count,
            };
            const unreadChannel = {
              ...existingChannel,
              unreadTopics: existingChannel.unreadTopics.map(t => (t.id === event.channel_id ? topic : t)),
            };

            dispatch(UpdateUnreadChannel(unreadChannel));
          } else {
            // Thêm topic mới vào danh sách unreadChannels
            const topic = {
              id: event.channel_id,
              unreadCount: event.unread_count,
            };

            const unreadChannel = {
              id: channel.data.id,
              unreadCount: existingChannel ? existingChannel.unreadCount : 0,
              unreadTopics: [...(existingChannel ? existingChannel.unreadTopics : []), topic],
            };

            dispatch(AddUnreadChannel(unreadChannel));
          }
        } else if (isCurrentChannel) {
          // Là channel
          const existingChannel = unreadChannels && unreadChannels.find(item => item.id === event.channel_id);

          if (existingChannel) {
            // Cập nhật số lượng tin nhắn chưa đọc
            const updatedChannel = {
              ...existingChannel,
              unreadCount: event.unread_count,
            };
            dispatch(UpdateUnreadChannel(updatedChannel));
          } else {
            // Thêm channel mới vào danh sách unreadChannels
            const unreadChannel = {
              id: event.channel_id,
              unreadCount: event.unread_count,
              unreadTopics: [],
            };
            dispatch(AddUnreadChannel(unreadChannel));
          }
        }
      }

      if (isCurrentChannel || isTopicInChannel) {
        if (!(event.message.type === MessageType.Signal && ['1', '4'].includes(event.message.text[0]))) {
          // không cần hiển thị last message với AudioCallStarted (1) hoặc VideoCallStarted (4) khi có cuộc gọi
          getLastMessage(event.message);
        }
      }
    };

    const handleMessageUpdated = event => {
      const isCurrentChannel = event.channel_id === channel.data.id;
      const isTopicInChannel = event.parent_cid === channel.cid;

      if (isCurrentChannel || isTopicInChannel) {
        // Sử dụng hàm tối ưu thay vì tính toán lại
        const updatedLastMsg = getOptimizedLastMessage(channel);
        getLastMessage(updatedLastMsg);
      }
    };

    const handleMessageDeleted = event => {
      const isCurrentChannel = event.channel_id === channel.data.id;
      const isTopicInChannel = event.parent_cid === channel.cid;

      if (isCurrentChannel || isTopicInChannel) {
        // Sử dụng hàm tối ưu thay vì tính toán lại
        const updatedLastMsg = getOptimizedLastMessage(channel);
        getLastMessage(updatedLastMsg);
      }
    };

    const handleMessageRead = event => {
      if (event.user.id === user_id) {
        const isCurrentChannel = event.channel_id === channel.data.id;

        // Kiểm tra channel_id là topic hay channel
        const topicInChannel = channel.state.topics && channel.state.topics.find(t => t.id === event.channel_id);

        if (topicInChannel) {
          // Là topic
          const existingChannel = unreadChannels && unreadChannels.find(item => item.id === channel.data.id);
          if (existingChannel) {
            const existingTopic = existingChannel.unreadTopics.find(t => t.id === topicInChannel.id);
            if (existingTopic) {
              dispatch(RemoveUnreadChannel(channel.data.id, topicInChannel.id));
            }
          }
        } else if (isCurrentChannel) {
          // Là channel
          if (unreadChannels.some(item => item.id === event.channel_id)) {
            dispatch(RemoveUnreadChannel(event.channel_id));
          }
        }
      }
    };

    const handleMemberBlocked = event => {
      if (event.user.id === user_id && event.channel_id === channel.data.id) {
        setIsBlocked(true);
      }
    };

    const handleMemberUnBlocked = event => {
      if (event.user.id === user_id && event.channel_id === channel.data.id) {
        setIsBlocked(false);
      }
    };

    client.on(ClientEvents.MessageNew, handleMessageNew);
    client.on(ClientEvents.MessageUpdated, handleMessageUpdated);
    client.on(ClientEvents.MessageDeleted, handleMessageDeleted);
    client.on(ClientEvents.MessageRead, handleMessageRead);
    client.on(ClientEvents.MemberBlocked, handleMemberBlocked);
    client.on(ClientEvents.MemberUnblocked, handleMemberUnBlocked);
    return () => {
      client.off(ClientEvents.MessageNew, handleMessageNew);
      client.off(ClientEvents.MessageUpdated, handleMessageUpdated);
      client.off(ClientEvents.MessageDeleted, handleMessageDeleted);
      client.off(ClientEvents.MessageRead, handleMessageRead);
      client.off(ClientEvents.MemberBlocked, handleMemberBlocked);
      client.off(ClientEvents.MemberUnblocked, handleMemberUnBlocked);
    };
  }, [channel, user_id, users.length, unreadChannels, getOptimizedLastMessage]);

  const onLeftClick = () => {
    if (!isRightClick) {
      navigate(`${DEFAULT_PATH}/${channel.cid}`);
      dispatch(onReplyMessage(null));
      dispatch(onEditMessage(null));

      dispatch(SetOpenTopicPanel(isEnabledTopics ? true : false));
    }
    setAnchorEl(null);
  };

  const onRightClick = event => {
    event.preventDefault();
    setIsRightClick(true);
    setAnchorEl(event.currentTarget);
  };

  const onCloseMenu = () => {
    setAnchorEl(null);
    setIsRightClick(false);
  };

  const onMarkAsRead = () => {
    dispatch(SetMarkReadChannel(channel));
  };

  const onLeave = () => {
    const payload = {
      openDialog: true,
      channel,
      userId: user_id,
      type: ConfirmType.LEAVE,
    };
    dispatch(setChannelConfirm(payload));
  };

  const onDelete = () => {
    const payload = {
      openDialog: true,
      channel,
      userId: user_id,
      type: ConfirmType.DELETE_CHANNEL,
    };
    dispatch(setChannelConfirm(payload));
  };

  const onClearChatHistory = () => {
    const payload = {
      openDialog: true,
      channel,
      userId: user_id,
      type: ConfirmType.TRUNCATE,
    };
    dispatch(setChannelConfirm(payload));
  };

  const onPinChannel = async () => {
    if (isPinned) {
      await client.unpinChannel(channelType, channelId);
    } else {
      await client.pinChannel(channelType, channelId);
    }
  };

  return (
    <>
      <StyledChatBox
        onClick={onLeftClick}
        onContextMenu={onRightClick}
        sx={{
          backgroundColor:
            currentChannel?.id === channelId ? `${alpha(theme.palette.primary.main, 0.2)} !important` : 'transparent',
          padding: '8px',
          margin: '-8px',
        }}
        gap={2}
      >
        {/* -------------------------------avatar------------------------------- */}
        <Box sx={{ position: 'relative', width: 60, height: 60 }}>
          {hasUnread && openTopicPanel ? (
            <Badge
              variant="dot"
              color="error"
              sx={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                zIndex: 2,
                '& .MuiBadge-badge': {
                  minWidth: '12px',
                  width: '12px',
                  height: '12px',
                },
              }}
            />
          ) : null}
          <ChannelAvatar channel={channel} width={60} height={60} shape={AvatarShape.Round} />
        </Box>

        {/* -------------------------------content------------------------------- */}
        <Box
          sx={{
            flex: openTopicPanel ? 0 : 1,
            minWidth: 'auto',
            overflow: 'hidden',
          }}
        >
          {/* -------------------------------channel name------------------------------- */}
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
              {channel.data.name}
            </Typography>

            <Stack direction="row" alignItems="center" justifyContent="flex-end" gap={1}>
              {isMuted && <SpearkerOffIcon size={14} />}
              {isPinned && <PushPin size={14} color={theme.palette.primary.main} weight="fill" />}

              {!isBlocked && (
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
              )}
            </Stack>
          </Stack>

          {/* -------------------------------list topic------------------------------- */}
          {isEnabledTopics && <ListTopic topics={topics} />}

          {/* -------------------------------last message------------------------------- */}
          {!isBlocked && (
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <Typography
                variant="caption"
                sx={{
                  color: hasUnread ? 'inherit' : theme.palette.text.secondary,
                  flex: 1,
                  minWidth: 'auto',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: '14px',
                  display: 'block',
                  fontWeight: hasUnread ? 600 : 400,
                }}
              >
                {isBlocked ? 'You have block this user' : lastMessage}
              </Typography>

              {hasUnread ? <Badge variant="dot" color="error" sx={{ margin: '0 10px 0 15px' }} /> : null}
            </Stack>
          )}
        </Box>
      </StyledChatBox>

      <StyledMenu
        anchorEl={anchorEl}
        open={openMenu}
        elevation={0}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        onClose={onCloseMenu}
        onClick={onCloseMenu}
      >
        {/* --------------------Pin/Unpin channel---------------- */}
        <MenuItem onClick={onPinChannel}>
          {isPinned ? <PushPinSlash /> : <PushPin />}
          {isPinned ? 'Unpin from top' : 'Pin to top'}
        </MenuItem>

        {/* --------------------Mark as read---------------- */}
        {/* {showItemMarkAsRead && (
          <MenuItem onClick={onMarkAsRead}>
            <EnvelopeSimpleOpen />
            Mark as read
          </MenuItem>
        )} */}

        {/* --------------------Delete channel---------------- */}
        {showItemDeleteChannel && (
          <MenuItem sx={{ color: theme.palette.error.main }} onClick={onDelete}>
            <Trash color={theme.palette.error.main} />
            Delete channel
          </MenuItem>
        )}

        {/* --------------------Leave channel---------------- */}
        {showItemLeaveChannel && (
          <MenuItem sx={{ color: theme.palette.error.main }} onClick={onLeave}>
            <SignOut color={theme.palette.error.main} />
            Leave channel
          </MenuItem>
        )}

        {/* --------------------Clear chat history---------------- */}
        {showItemDeleteConversation && (
          <MenuItem sx={{ color: theme.palette.error.main }} onClick={onClearChatHistory}>
            <Trash color={theme.palette.error.main} />
            Clear chat history
          </MenuItem>
        )}
      </StyledMenu>
    </>
  );
};

export default ChatElement;
