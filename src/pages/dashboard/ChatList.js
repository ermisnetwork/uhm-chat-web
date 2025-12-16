import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Box, Paper, styled } from '@mui/material';
import { useSelector } from 'react-redux';
import { MessageType } from '../../constants/commons-const';
import SystemMsg from '../../components/message/SystemMsg';
import StickerMsg from '../../components/message/StickerMsg';
import PollMsg from '../../components/message/PollMsg';
import RegularMsg from '../../components/message/RegularMsg';
import SignalMsg from '../../components/message/SignalMsg';
import { getMessageGroupingProps, shouldShowDateHeader } from '../../utils/formatTime';
import DateSeparator from '../../components/message/DateSeparator';

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
  // Lấy data từ Redux
  const { currentChannel } = useSelector(state => state.channel);
  const { user_id } = useSelector(state => state.auth);
  const { currentTopic } = useSelector(state => state.topic);

  // State
  const [messages, setMessages] = useState([]);
  const [firstItemIndex, setFirstItemIndex] = useState(INDEX_OFFSET);
  const [hasMore, setHasMore] = useState(true);

  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const virtuosoRef = useRef(null);
  const isScrollingToMsgRef = useRef(false);

  const currentChat = useMemo(() => (currentTopic ? currentTopic : currentChannel), [currentTopic, currentChannel]);
  const chatKey = currentChat?.id || 'default-chat';

  // --- LOGIC LOAD BAN ĐẦU ---
  useEffect(() => {
    if (!currentChat) return;

    setHasMore(true);
    setFirstItemIndex(INDEX_OFFSET);

    const listMessage = currentChat.state?.messages || [];

    setMessages(listMessage);
    isScrollingToMsgRef.current = false;
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

  return (
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
  );
};

export default ChatList;
