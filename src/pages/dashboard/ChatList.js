import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Box, Paper, styled } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { MessageType } from '../../constants/commons-const';
import SystemMsg from '../../components/message/SystemMsg';
import StickerMsg from '../../components/message/StickerMsg';
import PollMsg from '../../components/message/PollMsg';
import RegularMsg from '../../components/message/RegularMsg';
import SignalMsg from '../../components/message/SignalMsg';
import { getMessageGroupingProps, shouldShowDateHeader } from '../../utils/formatTime';
import DateSeparator from '../../components/message/DateSeparator';
import ReadBy from '../../components/ReadBy';
import ScrollToBottom from '../../components/ScrollToBottom';

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

const MessageItemContent = React.memo(({ message, prevMsg, nextMsg, isHighlighted, onScrollToReplyMsg }) => {
  const groupingProps = useMemo(() => getMessageGroupingProps(message, prevMsg, nextMsg), [message, prevMsg, nextMsg]);

  const showDate = useMemo(() => shouldShowDateHeader(message, prevMsg), [message, prevMsg]);

  const isMyMessage = message.user.id === message.myUserId;

  const contextProps = {
    onScrollToReplyMsg,
    isHighlighted,
    ...groupingProps,
  };

  return (
    <StyledMessageItem className={`${isMyMessage ? 'myMessage' : ''}`}>
      {showDate && <DateSeparator dateString={message.created_at} />}
      {renderMessageContent({ ...message, isMyMessage }, contextProps)}
    </StyledMessageItem>
  );
});

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

const ChatList = React.memo(({ messages, setMessages }) => {
  // Lấy data từ Redux
  const { currentChannel, isGuest, isBlocked, isBanned } = useSelector(state => state.channel);

  const { user_id } = useSelector(state => state.auth);
  const { currentTopic } = useSelector(state => state.topic);

  // State
  // const [messages, setMessages] = useState([]);
  const [firstItemIndex, setFirstItemIndex] = useState(INDEX_OFFSET);
  const [hasMore, setHasMore] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const virtuosoRef = useRef(null);
  const isScrollingToMsgRef = useRef(false);

  const currentChat = useMemo(() => (currentTopic ? currentTopic : currentChannel), [currentTopic, currentChannel]);
  const chatKey = currentChat?.id || 'default-chat';

  // --- LOGIC LOAD BAN ĐẦU ---
  useEffect(() => {
    if (!currentChat) return;

    setHasMore(true);
    setFirstItemIndex(INDEX_OFFSET);

    // const listMessage = currentChat.state?.messages || [];
    // setMessages(listMessage);

    isScrollingToMsgRef.current = false;
    setShowScrollBottom(false);
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

  const handleScrollToBottom = useCallback(() => {
    if (virtuosoRef.current && messages.length > 0) {
      virtuosoRef.current.scrollToIndex({
        index: messages.length,
        align: 'end',
        behavior: 'auto',
      });
    }
  }, [messages.length]);

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
        setTimeout(() => {
          isScrollingToMsgRef.current = false;
        }, 1000);
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

  const virtuosoComponents = useMemo(
    () => ({
      Footer: () => {
        if (isGuest || isBlocked || isBanned) return null;
        return (
          <Box sx={{ pb: 0, px: 2 }}>
            <ReadBy />
          </Box>
        );
      },
    }),
    [isGuest, isBlocked, isBanned],
  );

  const itemContent = useCallback(
    (index, message) => {
      const realIndex = index - firstItemIndex;
      const previousMessage = messages[realIndex - 1];
      const nextMessage = messages[realIndex + 1];
      const msgWithMyId = { ...message, myUserId: user_id };

      return (
        <MessageItemContent
          message={msgWithMyId}
          prevMsg={previousMessage}
          nextMsg={nextMessage}
          isHighlighted={message.id === highlightedMessageId}
          onScrollToReplyMsg={handleScrollToMessage}
        />
      );
    },
    [messages, firstItemIndex, highlightedMessageId, user_id, handleScrollToMessage],
  );

  return (
    <Paper
      elevation={0}
      sx={{
        width: '100%',
        height: '100%',
        mx: 'auto',
        // my: 4,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        key={chatKey}
        className="customScrollbar"
        style={{ height: '100%', overflowX: 'hidden' }}
        data={messages}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={messages.length}
        // initialTopMostItemIndex={{ index: messages.length, align: 'end' }}
        followOutput={'smooth'}
        overscan={{
          reverse: 800, // load sẵn tin nhắn cũ
          main: 300, // load sẵn tin nhắn mới
        }}
        startReached={queryMessagesLessThanId}
        atBottomThreshold={200}
        atBottomStateChange={atBottom => {
          setShowScrollBottom(!atBottom);
        }}
        itemContent={itemContent}
        components={virtuosoComponents}
      />

      <ScrollToBottom showScrollBottom={showScrollBottom} handleScrollToBottom={handleScrollToBottom} />
    </Paper>
  );
});

export default ChatList;
