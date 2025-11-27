import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { Box, Paper, Typography, CircularProgress } from '@mui/material'; // Thêm CircularProgress
import { format } from 'date-fns';
import { useSelector } from 'react-redux';
import MemberAvatar from '../../components/MemberAvatar';

// Định nghĩa số lượng tin nhắn tối đa ban đầu nếu cần
const INITIAL_LOAD_LIMIT = 25;
const INDEX_OFFSET = 10000; // Index lớn ban đầu

const MessageBubble = React.memo(({ message, myUserId }) => {
  const isMe = message.user?.id === myUserId;
  const date = message.created_at ? new Date(message.created_at) : new Date();
  const timeString = format(date, 'HH:mm');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: isMe ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        mb: 2,
        px: 2,
        gap: 1,
      }}
    >
      {!isMe && <MemberAvatar member={message.user} width={36} height={36} />}
      <Box
        sx={{ maxWidth: '70%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: isMe ? '#0084ff' : '#f0f2f5',
            color: isMe ? '#fff' : '#000',
            borderTopRightRadius: isMe ? 4 : 20,
            borderTopLeftRadius: isMe ? 20 : 4,
          }}
        >
          <Typography variant="body2">{message.text}</Typography>
        </Paper>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, px: 1 }}>
          {timeString}
        </Typography>
      </Box>
    </Box>
  );
});

const ChatList = () => {
  // Lấy data từ Redux
  const { currentChannel } = useSelector(state => state.channel);
  const { user_id } = useSelector(state => state.auth);
  const { currentTopic } = useSelector(state => state.topic);

  // State
  const [messages, setMessages] = useState([]);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Index ảo lớn để hỗ trợ scroll ngược
  const [firstItemIndex, setFirstItemIndex] = useState(INDEX_OFFSET);

  // Xác định chat hiện tại
  const currentChat = useMemo(() => (currentTopic ? currentTopic : currentChannel), [currentTopic, currentChannel]);

  // Ref để theo dõi lần đầu tiên set messages
  const isInitialLoad = useRef(true);

  // --- LOGIC LOAD BAN ĐẦU ---
  useEffect(() => {
    if (!currentChat) return;

    // Lấy tin nhắn hiện tại từ Redux/State của chat
    const listMessage = currentChat.state?.messages || [];

    // Chỉ lấy giới hạn tin nhắn ban đầu để Virtuoso không phải render quá nhiều
    // Nếu listMessage lớn hơn giới hạn, chỉ lấy các tin mới nhất (cuối mảng)
    const initialMessages = listMessage.slice(-INITIAL_LOAD_LIMIT);

    // Đặt firstItemIndex dựa trên số lượng tin nhắn đã có trong state của chat
    // Đây là ước tính số lượng tin nhắn đã bị bỏ qua, để Virtuoso tính toán đúng index
    const messagesSkipped = listMessage.length - initialMessages.length;

    setMessages(initialMessages);
    // Nếu có tin nhắn bị bỏ qua, set firstItemIndex thấp hơn
    setFirstItemIndex(INDEX_OFFSET - messagesSkipped);

    // Kiểm tra xem còn tin nhắn cũ hơn không
    if (listMessage.length > 0 && messagesSkipped > 0) {
      setHasMore(true);
    } else {
      setHasMore(false);
    }

    isInitialLoad.current = false;
  }, [currentChat]);

  // --- LOGIC LOAD THÊM TIN NHẮN (OPTIMIZED) ---
  const loadMoreMessages = useCallback(async () => {
    // 1. NGĂN CHẶN RACING VÀ API CALL KHI ĐÃ HẾT
    if (isFetching || !hasMore || messages.length === 0) return;

    // 2. KÍCH HOẠT TRẠNG THÁI FETCHING
    setIsFetching(true);

    try {
      // Lấy ID tin nhắn cũ nhất đang hiển thị
      const msgId = messages[0].id;

      // Gọi API của chat, sử dụng msgId để lấy tin nhắn cũ hơn
      const olderMessages = await currentChat.queryMessagesLessThanId(msgId);

      if (olderMessages && Array.isArray(olderMessages) && olderMessages.length > 0) {
        // Chèn tin nhắn mới vào đầu mảng
        setMessages(prev => [...olderMessages, ...prev]);

        // Lùi index ảo đi đúng số lượng tin nhắn mới load
        setFirstItemIndex(prev => prev - olderMessages.length);
      } else {
        // Đã hết tin nhắn cũ để tải
        setHasMore(false);
      }
    } catch (error) {
      console.error('Lỗi khi tải tin nhắn cũ:', error);
    } finally {
      // Tắt trạng thái fetching
      setIsFetching(false);
    }
  }, [currentChat, messages, isFetching, hasMore]);

  // Theo dõi tin nhắn mới được nhận (nếu có logic update Redux)
  // Nếu Redux update messages, component này sẽ re-render và tự động cuộn xuống nhờ followOutput

  return (
    <Paper
      elevation={3}
      sx={{
        width: '100%',
        maxWidth: 500,
        height: 600,
        mx: 'auto',
        my: 4,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#fff',
      }}
    >
      <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
        <Typography variant="h6">Seamless Chat ({messages.length})</Typography>
        <Typography variant="caption" color="text.secondary">
          {isFetching ? 'Đang tải...' : hasMore ? 'Kéo lên để xem tin cũ' : 'Đã hết tin nhắn.'}
        </Typography>
      </Box>

      <Box sx={{ flex: 1 }}>
        <Virtuoso
          style={{ height: '100%' }}
          data={messages}
          // Index ảo và khởi tạo scroll
          firstItemIndex={firstItemIndex}
          initialTopMostItemIndex={messages.length - 1}
          // Rất quan trọng cho chat: Tự động cuộn xuống khi có tin nhắn mới
          followOutput={'smooth'}
          // KỸ THUẬT SEAMLESS: Overscan
          overscan={500}
          // Gọi hàm loadMoreMessages khi chạm vào vùng overscan
          startReached={loadMoreMessages}
          // Hiển thị loading/hết tin nhắn ở Header (không làm nhảy content)
          components={{
            Header: () => (
              <Box sx={{ height: 30, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {!hasMore && (
                  <Typography variant="caption" color="text.disabled">
                    Đã hết tin nhắn
                  </Typography>
                )}
                {/* Không hiển thị spinner nếu isFetching để duy trì seamless experience */}
              </Box>
            ),
          }}
          itemContent={(index, message) => (
            <Box sx={{ pt: index === 0 ? 2 : 0 }}>
              <MessageBubble message={message} myUserId={user_id} />
            </Box>
          )}
        />
      </Box>
    </Paper>
  );
};

export default ChatList;
