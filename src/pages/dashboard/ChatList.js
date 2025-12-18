import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Box, Paper, styled } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { DefaultLastSend, MessageType, RoleMember } from '../../constants/commons-const';
import SystemMsg from '../../components/message/SystemMsg';
import StickerMsg from '../../components/message/StickerMsg';
import PollMsg from '../../components/message/PollMsg';
import RegularMsg from '../../components/message/RegularMsg';
import SignalMsg from '../../components/message/SignalMsg';
import { getMessageGroupingProps, shouldShowDateHeader } from '../../utils/formatTime';
import DateSeparator from '../../components/message/DateSeparator';
import ScrollToBottom from '../../components/ScrollToBottom';
import { ChatFooter } from '../../components/Chat';
import UsersTyping from '../../components/UsersTyping';
import { ClientEvents } from '../../constants/events-const';
import useMessageSound from '../../hooks/useMessageSound';
import {
  checkPendingInvite,
  getChannelName,
  isChannelDirect,
  isGuestInPublicChannel,
  myRoleInChannel,
  splitChannelId,
} from '../../utils/commons';
import {
  AddMention,
  SetCooldownTime,
  SetFilterWords,
  SetIsBanned,
  SetIsGuest,
  SetMarkReadChannel,
  SetMemberCapabilities,
  WatchCurrentChannel,
} from '../../redux/slices/channel';
import { DEFAULT_PATH } from '../../config';
import { client } from '../../client';
import useResponsive from '../../hooks/useResponsive';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SetIsClosedTopic } from '../../redux/slices/topic';

const StyledMessageItem = styled(Box)(({ theme }) => ({
  '&:hover': {
    '& .messageActions': {
      visibility: 'visible',
    },

    '& .quickReactions': {
      visibility: 'visible',
    },
  },
  '&.myMessage': {
    '& .linkUrl': {
      color: '#f1f1f1',
    },
  },
  '& .messageActions.open': {
    visibility: 'visible',
  },

  '& .quickReactions': {
    visibility: 'hidden',
  },
}));

const INDEX_OFFSET = 10000;

const MessageComponentMap = {
  [MessageType.Regular]: RegularMsg,
  [MessageType.System]: SystemMsg,
  [MessageType.Sticker]: StickerMsg,
  [MessageType.Poll]: PollMsg,
  [MessageType.Signal]: SignalMsg,
};

const renderMessageContent = (message, contextProps) => {
  const SpecificComponent = MessageComponentMap[message.type] || RegularMsg;

  return <SpecificComponent message={message} {...contextProps} />;
};

const ChatList = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Lấy data từ Redux
  const { currentChannel, isBlocked, isGuest, isBanned } = useSelector(state => state.channel);

  const { user_id } = useSelector(state => state.auth);
  const { currentTopic, isClosedTopic } = useSelector(state => state.topic);

  // State
  const [messages, setMessages] = useState([]);
  const [firstItemIndex, setFirstItemIndex] = useState(INDEX_OFFSET);
  const [hasMore, setHasMore] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [usersTyping, setUsersTyping] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isPendingInvite, setIsPendingInvite] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastReadMessageId, setLastReadMessageId] = useState('');
  const [isAlertInvitePending, setIsAlertInvitePending] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [showChipUnread, setShowChipUnread] = useState(false);
  const [highlightMsg, setHighlightMsg] = useState('');
  const [noMessageTitle, setNoMessageTitle] = useState('');

  const virtuosoRef = useRef(null);
  const isScrollingToMsgRef = useRef(false);

  const currentChat = useMemo(() => (currentTopic ? currentTopic : currentChannel), [currentTopic, currentChannel]);
  const isDirect = useMemo(() => isChannelDirect(currentChannel), [currentChannel]);
  const users = useMemo(() => (client.state.users ? Object.values(client.state.users) : []), [client.state.users]);
  const isLgToXl = useResponsive('between', null, 'lg', 'xl');
  const isMobileToLg = useResponsive('down', 'lg');
  const chatKey = currentChat?.id || 'default-chat';

  const { playNewMessageSound, cleanup } = useMessageSound();

  // --- LOGIC LOAD BAN ĐẦU ---
  useEffect(() => {
    if (!currentChat) return;

    setHasMore(true);
    setFirstItemIndex(INDEX_OFFSET);

    const listMessage = currentChat.state?.messages || [];
    const channelName = currentChat.data.name ? currentChat.data.name : getChannelName(currentChat, users);
    document.title = channelName;
    const members = Object.values(currentChat.state.members);
    const receiverInfo = members.find(member => member.user_id !== user_id);
    setIsAlertInvitePending(isDirect && [RoleMember.PENDING, RoleMember.SKIPPED].includes(receiverInfo?.channel_role));
    setIsPendingInvite(checkPendingInvite(currentChat));
    setUnreadCount(currentChat.state.unreadCount);
    dispatch(SetIsGuest(isGuestInPublicChannel(currentChat)));
    setNoMessageTitle(listMessage.length ? '' : t('chatComponent.no_message'));
    setMessages(listMessage);

    const read = currentChat.state.read[user_id];
    const lastReadMsgId = read && read?.unread_messages ? read.last_read_message_id : '';
    setLastReadMessageId(lastReadMsgId);
    let lastSend = (read && read?.last_send) || DefaultLastSend;
    let duration = currentChat.data.member_message_cooldown || 0;

    const onSetCooldownTime = event => {
      const myRole = myRoleInChannel(currentChat);
      if (event.type === ClientEvents.MessageNew) {
        if (event.user.id === user_id && event.channel_type === ChatType.TEAM && myRole === RoleMember.MEMBER) {
          lastSend = event.message.created_at;

          if (duration) {
            dispatch(SetCooldownTime({ duration, lastSend }));
          } else {
            dispatch(SetCooldownTime(null));
          }
        }
      }

      if (event.type === ClientEvents.ChannelUpdated) {
        if (event.user.id !== user_id && event.channel_type === ChatType.TEAM && myRole === RoleMember.MEMBER) {
          duration = event.channel.member_message_cooldown ? event.channel.member_message_cooldown : 0;

          if (duration) {
            dispatch(SetCooldownTime({ duration, lastSend }));
          } else {
            dispatch(SetCooldownTime(null));
          }
        }
      }
    };

    const onSetFilterWords = event => {
      if (event.type === ClientEvents.ChannelUpdated && event.channel_type === ChatType.TEAM) {
        dispatch(SetFilterWords(event.channel.filter_words || []));
      }
    };

    if (![RoleMember.PENDING, RoleMember.SKIPPED].includes(myRoleInChannel(currentChat))) {
      setTimeout(() => {
        dispatch(SetMarkReadChannel(currentChat));
      }, 100);
    }

    isScrollingToMsgRef.current = false;

    const handleMessages = event => {
      switch (event.type) {
        case ClientEvents.MessageNew:
          const messageType = event.message.type;

          // Phát âm thanh cho tin nhắn mới (trừ tin nhắn system/signal)
          if (![MessageType.System, MessageType.Signal].includes(messageType)) {
            playNewMessageSound();
          }

          if (user_id !== event.user.id || [MessageType.System, MessageType.Signal].includes(event.message.type)) {
            setMessages(prev => {
              return [...prev, event.message];
            });
            const myRole = myRoleInChannel(currentChat);
            if (![RoleMember.PENDING, RoleMember.SKIPPED].includes(myRole)) {
              setTimeout(() => {
                dispatch(SetMarkReadChannel(currentChat));
              }, 100);
            }
          } else {
            setMessages(prev => {
              if (prev.some(item => item.id === event.message.id)) {
                return prev.map(item => (item.id === event.message.id ? event.message : item));
              } else {
                return [...prev, event.message];
              }
            });
          }

          setLastReadMessageId('');
          setUnreadCount(0);
          // messageListRef.current.scrollTop = messageListRef.current?.scrollHeight;
          onSetCooldownTime(event);
          setNoMessageTitle('');
          break;
        case ClientEvents.ReactionDeleted:
          setMessages(prev => {
            return prev.map(item => (item.id === event.message.id ? event.message : item));
          });
          break;
        case ClientEvents.ReactionNew:
          setMessages(prev => {
            return prev.map(item => (item.id === event.message.id ? event.message : item));
          });
          break;
        case ClientEvents.MessageDeleted:
          setMessages(prev =>
            prev
              .filter(item => item.id !== event.message.id) // Loại bỏ message bị xoá
              .map(item => {
                // Nếu là reply tới message bị xoá thì xoá dữ liệu reply
                if (item.quoted_message_id === event.message.id) {
                  return {
                    ...item,
                    quoted_message: undefined,
                    quoted_message_id: undefined,
                  };
                }
                return item;
              }),
          );
          break;
        case ClientEvents.MessageUpdated:
          setMessages(prev => {
            return prev.map(item => (item.id === event.message.id ? event.message : item));
          });
          dispatch(SetMessagesHistoryDialog({ openDialog: false, messages: event.message?.old_texts || [] }));
          break;
        case ClientEvents.PollChoiceNew:
          setMessages(prev => {
            return prev.map(item => (item.id === event.message.id ? event.message : item));
          });
          break;
        default:
          setMessages([]);
          break;
      }
    };

    const handleTypingStart = event => {
      if (user_id !== event.user.id) {
        const name = event.user?.name ? event.user?.name : formatString(event.user.id);

        const item = {
          name: name,
          id: event.user.id,
        };

        setUsersTyping(prev => {
          const updatedItems = [...prev, item];

          // lọc các item trùng nhau theo id
          const uniqueItems = Object.values(
            updatedItems.reduce((acc, item) => {
              acc[item.id] = item;
              return acc;
            }, {}),
          );

          return uniqueItems;
        });
      } else {
        setUsersTyping([]);
      }
    };

    const handleTypingStop = event => {
      if (user_id !== event.user.id) {
        setUsersTyping(prev => prev.filter(item => item.id !== event.user.id));
      } else {
        setUsersTyping([]);
      }
    };

    const handleInviteAccept = async event => {
      const splitCID = splitChannelId(event.cid);
      const channelId = splitCID.channelId;
      const channelType = splitCID.channelType;
      dispatch(WatchCurrentChannel(channelId, channelType));

      if (event.member.user_id === user_id) {
        setIsPendingInvite(false);
      } else {
        setIsAlertInvitePending(false);
        dispatch(AddMention(event.member.user_id));
      }
    };

    const handleInviteSkipped = async event => {
      if (event.member.user_id === user_id) {
        navigate(`${DEFAULT_PATH}`);
        setIsPendingInvite(false);
      }
    };

    const handleChannelUpdated = event => {
      const member_capabilities = event.channel.member_capabilities;
      dispatch(SetMemberCapabilities(member_capabilities));
      onSetCooldownTime(event);
      onSetFilterWords(event);
    };

    const handleMemberJoined = event => {
      const splitCID = splitChannelId(event.cid);
      const channelId = splitCID.channelId;
      const channelType = splitCID.channelType;

      if (event.member.user_id === user_id) {
        dispatch(SetIsGuest(false));
        dispatch(AddActiveChannel(event.cid));
      } else {
        dispatch(WatchCurrentChannel(channelId, channelType));
        dispatch(AddMention(event.member.user_id));
      }
    };

    const handleMemberPromoted = event => {
      const channelId = event.channel_id;
      const channelType = event.channel_type;
      dispatch(WatchCurrentChannel(channelId, channelType));
    };

    const handleMemberDemoted = event => {
      const channelId = event.channel_id;
      const channelType = event.channel_type;
      dispatch(WatchCurrentChannel(channelId, channelType));
    };

    const handleMemberBanned = event => {
      if (event.member.user_id === user_id) {
        dispatch(SetIsBanned(event.member.banned));
      }
    };

    const handleMemberUnBanned = event => {
      if (event.member.user_id === user_id) {
        dispatch(SetIsBanned(event.member.banned));
      }
    };

    const handleChannelTruncate = event => {
      setMessages(currentChat.state.messages || []);
    };

    const handleChannelTopicClosed = event => {
      dispatch(SetIsClosedTopic(true));
    };

    const handleChannelTopicReopen = event => {
      dispatch(SetIsClosedTopic(false));
    };

    currentChat.on(ClientEvents.MessageNew, handleMessages);
    currentChat.on(ClientEvents.ReactionNew, handleMessages);
    currentChat.on(ClientEvents.ReactionDeleted, handleMessages);
    currentChat.on(ClientEvents.MessageDeleted, handleMessages);
    currentChat.on(ClientEvents.MessageUpdated, handleMessages);
    currentChat.on(ClientEvents.TypingStart, handleTypingStart);
    currentChat.on(ClientEvents.TypingStop, handleTypingStop);
    currentChat.on(ClientEvents.Notification.InviteAccepted, handleInviteAccept);
    currentChat.on(ClientEvents.Notification.InviteSkipped, handleInviteSkipped);
    currentChat.on(ClientEvents.ChannelUpdated, handleChannelUpdated);
    currentChat.on(ClientEvents.MemberJoined, handleMemberJoined);
    currentChat.on(ClientEvents.MemberPromoted, handleMemberPromoted);
    currentChat.on(ClientEvents.MemberDemoted, handleMemberDemoted);
    currentChat.on(ClientEvents.MemberBanned, handleMemberBanned);
    currentChat.on(ClientEvents.MemberUnBanned, handleMemberUnBanned);
    currentChat.on(ClientEvents.PollChoiceNew, handleMessages);
    currentChat.on(ClientEvents.ChannelTruncate, handleChannelTruncate);
    currentChat.on(ClientEvents.ChannelTopicClosed, handleChannelTopicClosed);
    currentChat.on(ClientEvents.ChannelTopicReopen, handleChannelTopicReopen);

    return () => {
      currentChat.off(ClientEvents.MessageNew, handleMessages);
      currentChat.off(ClientEvents.ReactionNew, handleMessages);
      currentChat.off(ClientEvents.ReactionDeleted, handleMessages);
      currentChat.off(ClientEvents.MessageDeleted, handleMessages);
      currentChat.off(ClientEvents.MessageUpdated, handleMessages);
      currentChat.off(ClientEvents.TypingStart, handleTypingStart);
      currentChat.off(ClientEvents.TypingStop, handleTypingStop);
      currentChat.off(ClientEvents.Notification.InviteAccepted, handleInviteAccept);
      currentChat.off(ClientEvents.Notification.InviteSkipped, handleInviteSkipped);
      currentChat.off(ClientEvents.ChannelUpdated, handleChannelUpdated);
      currentChat.off(ClientEvents.MemberJoined, handleMemberJoined);
      currentChat.off(ClientEvents.MemberPromoted, handleMemberPromoted);
      currentChat.off(ClientEvents.MemberDemoted, handleMemberDemoted);
      currentChat.off(ClientEvents.MemberBanned, handleMemberBanned);
      currentChat.off(ClientEvents.MemberUnBanned, handleMemberUnBanned);
      currentChat.off(ClientEvents.PollChoiceNew, handleMessages);
      currentChat.off(ClientEvents.ChannelTruncate, handleChannelTruncate);
      currentChat.off(ClientEvents.ChannelTopicClosed, handleChannelTopicClosed);
      currentChat.off(ClientEvents.ChannelTopicReopen, handleChannelTopicReopen);

      // Cleanup audio khi thay đổi chat hoặc component unmount
      cleanup();
    };
  }, [currentChat]);

  const scrollToIndex = useCallback(
    async (index, msgId) => {
      if (!virtuosoRef.current) return;

      virtuosoRef.current.scrollToIndex({
        index,
        align: 'center',
        behavior: 'auto',
      });
      setHighlightedMessageId(msgId);
      setTimeout(() => {
        setHighlightedMessageId(null);
      }, 1000);
    },
    [virtuosoRef],
  );

  const queryMessagesGreaterThanId = useCallback(
    async targetMessageId => {
      if (!targetMessageId) return;

      try {
        isScrollingToMsgRef.current = true;
        const olderMessages = await currentChat.queryMessagesGreaterThanId(targetMessageId, 1000);

        if (olderMessages && Array.isArray(olderMessages) && olderMessages.length > 0) {
          setFirstItemIndex(INDEX_OFFSET);
          setMessages(olderMessages);

          const messageIndex = olderMessages.findIndex(msg => msg.id === targetMessageId);
          if (messageIndex !== -1) {
            scrollToIndex(messageIndex, targetMessageId);
          }
        }
      } catch (error) {
        console.error('Lỗi khi tải tin nhắn cũ:', error);
      } finally {
        // 3. TẮT CỜ CHẶN: Nhưng phải set Timeout để đợi animation scroll hoàn tất
        // Nếu tắt ngay lập tức, startReached vẫn có thể bị trigger do quán tính scroll
        setTimeout(() => {
          isScrollingToMsgRef.current = false;
        }, 1000); // Thời gian delay tùy thuộc vào animation time, 1s là an toàn
      }
    },
    [currentChat],
  );

  const queryMessagesLessThanId = useCallback(async () => {
    if (!hasMore || messages.length === 0 || isScrollingToMsgRef.current) {
      return;
    }

    const msgId = messages[0]?.id;
    if (!msgId) return;

    try {
      const olderMessages = await currentChat.queryMessagesLessThanId(msgId);

      if (olderMessages && Array.isArray(olderMessages) && olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        setFirstItemIndex(prev => prev - olderMessages.length);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Lỗi khi tải tin nhắn cũ:', error);
    }
  }, [currentChat, messages, hasMore]);

  // --- HÀM XỬ LÝ SCROLL ĐẾN TIN NHẮN ---
  const handleScrollToMessage = useCallback(
    targetMessageId => {
      if (!virtuosoRef.current) return;

      // 1. Tìm index thực của tin nhắn trong mảng messages
      const messageIndex = messages.findIndex(msg => msg.id === targetMessageId);

      if (messageIndex !== -1) {
        scrollToIndex(messageIndex, targetMessageId);
      } else {
        queryMessagesGreaterThanId(targetMessageId);
        console.warn('Tin nhắn không tồn tại trong danh sách đã tải (cần xử lý load thêm nếu cần)');
      }
    },
    [messages, firstItemIndex],
  );

  const showChatFooter = useMemo(() => !isGuest && !isBanned && !isClosedTopic, [isGuest, isBanned, isClosedTopic]);
  const showButtonScrollToBottom = useMemo(() => !isBlocked || !isBanned, [isBlocked, isBanned]);
  const disabledScroll = useMemo(() => isBlocked || isBanned, [isBlocked, isBanned]);

  return (
    <Box>
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          height: '600px',
          mx: 'auto',
          my: 4,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Virtuoso
            ref={virtuosoRef}
            key={chatKey}
            className="customScrollbar"
            style={{ height: '100%', overflowX: 'hidden' }}
            data={messages}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={messages.length - 1}
            // followOutput={'smooth'}
            overscan={500}
            startReached={queryMessagesLessThanId}
            itemContent={(index, message) => {
              const realIndex = index - firstItemIndex;
              const isMyMessage = message.user.id === user_id;
              const previousMessage = messages[realIndex - 1];
              const nextMessage = messages[realIndex + 1];

              const groupingProps = getMessageGroupingProps(message, previousMessage, nextMessage);
              const showDate = shouldShowDateHeader(message, previousMessage);
              const isHighlighted = message.id === highlightedMessageId;

              const commonProps = {
                messages,
                onScrollToReplyMsg: handleScrollToMessage,
                isHighlighted,
                ...groupingProps,
              };

              return (
                <StyledMessageItem className={`${isMyMessage ? 'myMessage' : ''}`}>
                  {showDate && <DateSeparator dateString={message.created_at} />}
                  {renderMessageContent({ ...message, isMyMessage }, commonProps)}
                </StyledMessageItem>
              );
            }}
          />
        </Box>
      </Paper>

      {/* {showButtonScrollToBottom && <ScrollToBottom messageListRef={virtuosoRef} />} */}
      {showChatFooter && (
        <Box
          sx={{
            padding: '15px',
            position: 'relative',
          }}
        >
          {usersTyping && usersTyping.length > 0 && <UsersTyping usersTyping={usersTyping} />}
          <ChatFooter setMessages={setMessages} isDialog={false} />
        </Box>
      )}
    </Box>
  );
};

export default ChatList;
