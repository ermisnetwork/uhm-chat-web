import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Box, Paper } from '@mui/material';
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
import { setSearchMessageId } from '../../redux/slices/messages';

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
    <Box className={`messageItem ${isMyMessage ? 'myMessage' : ''}`}>
      {showDate && <DateSeparator dateString={message.created_at} />}
      {renderMessageContent({ ...message, isMyMessage }, contextProps)}
    </Box>
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

const ChatList = React.memo(({ messages, setMessages, setFollowOutputRef }) => {
  const dispatch = useDispatch();
  // Lấy data từ Redux
  const { currentChannel, isGuest, isBlocked, isBanned } = useSelector(state => state.channel);
  const { user_id } = useSelector(state => state.auth);
  const { currentTopic } = useSelector(state => state.topic);
  const { searchMessageId } = useSelector(state => state.messages);

  // State
  // const [messages, setMessages] = useState([]);
  const [firstItemIndex, setFirstItemIndex] = useState(INDEX_OFFSET);
  const [hasMore, setHasMore] = useState(true);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [isReady, setIsReady] = useState(true); // Mặc định true

  const virtuosoRef = useRef(null);
  const isScrollingToMsgRef = useRef(false);
  const isLoadingOlderRef = useRef(false); // Track khi đang load tin nhắn cũ

  // Ref để track tin nhắn cuối là của mình hay người khác
  const isMyLastMessageRef = useRef(false);

  // Expose method để parent component set trước khi gọi setMessages
  useEffect(() => {
    if (setFollowOutputRef) {
      setFollowOutputRef.current = isMyMessage => {
        isMyLastMessageRef.current = isMyMessage;
      };
    }
  }, [setFollowOutputRef]);

  // Callback cho followOutput - quyết định có scroll hay không
  const handleFollowOutput = useCallback(isAtBottom => {
    // Đang scroll đến tin nhắn cụ thể -> không auto-scroll
    if (isScrollingToMsgRef.current) {
      return false;
    }
    // Đang load tin nhắn cũ -> không scroll
    if (isLoadingOlderRef.current) {
      return false;
    }
    // Tin nhắn của mình -> luôn scroll xuống
    if (isMyLastMessageRef.current) {
      return 'smooth';
    }
    // Tin nhắn người khác -> chỉ scroll nếu đang ở đáy
    return isAtBottom ? 'smooth' : false;
  }, []);

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
    isLoadingOlderRef.current = false;
    setShowScrollBottom(false);
  }, [currentChat]);

  // Xử lý visibility khi chuyển channel - CHỈ chạy khi chatKey thay đổi
  useLayoutEffect(() => {
    setIsReady(false);

    // Delay nhỏ để Virtuoso render xong rồi mới hiện
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [chatKey]); // CHỈ dependency là chatKey

  useEffect(() => {
    if (searchMessageId) {
      handleScrollToMessage(searchMessageId);
    }
  }, [searchMessageId]);

  const scrollToIndex = useCallback(
    async (index, msgId) => {
      if (!virtuosoRef.current) return;

      requestAnimationFrame(() => {
        virtuosoRef.current.scrollToIndex({
          index,
          align: 'center',
          behavior: 'auto',
        });
        setHighlightedMessageId(msgId);
        setTimeout(() => {
          setHighlightedMessageId(null);
          dispatch(setSearchMessageId(''));
        }, 1000);
      });
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

  const queryMessagesAroundId = useCallback(
    async targetMessageId => {
      if (!targetMessageId) return;

      try {
        isScrollingToMsgRef.current = true;
        const olderMessages = await currentChat.queryMessagesAroundId(targetMessageId, 10000);

        if (olderMessages && Array.isArray(olderMessages) && olderMessages.length > 0) {
          setFirstItemIndex(INDEX_OFFSET);
          setMessages(olderMessages);

          const messageIndex = olderMessages.findIndex(msg => msg.id === targetMessageId);
          if (messageIndex !== -1) {
            // Đợi Virtuoso render xong data mới trước khi scroll
            setTimeout(() => {
              scrollToIndex(messageIndex, targetMessageId);
            }, 100);
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
    [currentChat, scrollToIndex],
  );

  const queryMessagesLessThanId = useCallback(async () => {
    if (isScrollingToMsgRef.current) {
      return;
    }

    if (!hasMore || messages.length === 0) {
      return;
    }

    const msgId = messages[0]?.id;
    if (!msgId) return;

    try {
      // Set flag để ngăn scroll trong handleFollowOutput
      isLoadingOlderRef.current = true;

      const olderMessages = await currentChat.queryMessagesLessThanId(msgId);

      if (olderMessages && Array.isArray(olderMessages) && olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        setFirstItemIndex(prev => prev - olderMessages.length);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Lỗi khi tải tin nhắn cũ:', error);
    } finally {
      // Reset flag sau khi đã xong
      setTimeout(() => {
        isLoadingOlderRef.current = false;
      }, 500);
    }
  }, [currentChat, messages, hasMore, isScrollingToMsgRef]);

  // --- HÀM XỬ LÝ SCROLL ĐẾN TIN NHẮN ---
  const handleScrollToMessage = useCallback(
    targetMessageId => {
      if (!virtuosoRef.current) return;

      // 1. Tìm index thực của tin nhắn trong mảng messages
      const messageIndex = messages.findIndex(msg => msg.id === targetMessageId);

      if (messageIndex !== -1) {
        scrollToIndex(messageIndex, targetMessageId);
      } else {
        queryMessagesAroundId(targetMessageId);
        console.warn('Tin nhắn không tồn tại trong danh sách đã tải (cần xử lý load thêm nếu cần)');
      }
    },
    [messages],
  );

  const virtuosoComponents = useMemo(
    () => ({
      List: React.forwardRef((props, ref) => (
        <Box
          sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: 'calc(100% - 18px)' }}
          ref={ref}
          {...props}
        />
      )),

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
        pt: '15px',
      }}
    >
      <Virtuoso
        ref={virtuosoRef}
        key={chatKey}
        className="customScrollbar"
        style={{
          height: '100%',
          overflowX: 'hidden',
          visibility: isReady ? 'visible' : 'hidden',
        }}
        data={messages}
        firstItemIndex={firstItemIndex}
        initialTopMostItemIndex={messages.length - 1}
        followOutput={handleFollowOutput}
        // overscan={{
        //   reverse: 800, // load sẵn tin nhắn cũ
        //   main: 300, // load sẵn tin nhắn mới
        // }}
        increaseViewportBy={{ top: 900, bottom: 200 }}
        startReached={queryMessagesLessThanId}
        atBottomThreshold={200}
        atBottomStateChange={atBottom => {
          setShowScrollBottom(!atBottom);
        }}
        // Giúp giảm jitter khi prepend tin nhắn
        computeItemKey={(index, message) => message.id}
        itemContent={itemContent}
        components={virtuosoComponents}
      />

      <ScrollToBottom showScrollBottom={showScrollBottom} handleScrollToBottom={handleScrollToBottom} />
    </Paper>
  );
});

export default ChatList;
