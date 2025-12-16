import { format, getTime, formatDistanceToNow, isSameDay, isToday, isYesterday } from 'date-fns';
import dayjs from 'dayjs';

// ----------------------------------------------------------------------

export function fDate(date) {
  return format(new Date(date), 'dd MMMM yyyy');
}

export function fDateTime(date) {
  return format(new Date(date), 'dd/MM/yyyy, HH:mm');
}

export function fTimestamp(date) {
  return getTime(new Date(date));
}

export function fDateTimeSuffix(date) {
  return format(new Date(date), 'dd/MM/yyyy hh:mm p');
}

export function fToNow(date) {
  return formatDistanceToNow(new Date(date), {
    addSuffix: true,
  });
}

export function fTime(date) {
  return format(new Date(date), 'HH:mm');
}

export const getDisplayDate = timestamp => {
  if (!timestamp) return '';

  const now = dayjs();
  const date = dayjs(timestamp);

  // Check if it's today
  if (date.isSame(now, 'day')) {
    return date.format('HH:mm');
  }

  // Check if it's yesterday
  if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return 'Yesterday';
  }

  // Check if it's within the last 7 days (but not today or yesterday)
  const dayDiff = now.diff(date, 'day');
  if (dayDiff < 7) {
    return date.format('dddd'); // Returns the full day name
  }

  // Otherwise return the date in DD/MM/YYYY format
  return date.format('DD/MM/YYYY');
};

export const getMessageGroupingProps = (currentMessage, previousMessage, nextMessage) => {
  if (!currentMessage || !currentMessage.user) {
    return { isFirstInGroup: true, isLastInGroup: true };
  }

  const currentUserId = currentMessage.user.id;
  const currentDate = new Date(currentMessage.created_at);

  // 1. Kiểm tra với tin nhắn trước đó
  const isPreviousFromSameUser = previousMessage && previousMessage.user && previousMessage.user.id === currentUserId;
  const isPreviousSameDay = previousMessage && isSameDay(currentDate, new Date(previousMessage.created_at));

  // 2. Kiểm tra với tin nhắn tiếp theo
  const isNextFromSameUser = nextMessage && nextMessage.user && nextMessage.user.id === currentUserId;
  const isNextSameDay = nextMessage && isSameDay(currentDate, new Date(nextMessage.created_at));

  // isFirstInGroup: Bắt đầu một nhóm mới nếu người gửi/ngày khác với tin nhắn trước
  const isFirstInGroup = !isPreviousFromSameUser || !isPreviousSameDay;

  // isLastInGroup: Kết thúc một nhóm nếu người gửi/ngày khác với tin nhắn sau
  const isLastInGroup = !isNextFromSameUser || !isNextSameDay;

  return { isFirstInGroup, isLastInGroup };
};

export const shouldShowDateHeader = (currentMessage, previousMessage) => {
  if (!currentMessage) return false;

  // Nếu KHÔNG CÓ tin nhắn trước đó -> Đây là tin nhắn đầu tiên của list -> HIỆN
  if (!previousMessage) return true;

  const currentDate = new Date(currentMessage.created_at);
  const prevDate = new Date(previousMessage.created_at);

  // Nếu khác ngày -> HIỆN
  return !isSameDay(currentDate, prevDate);
};
