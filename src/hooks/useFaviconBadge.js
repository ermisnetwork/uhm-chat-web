import { useEffect, useState } from 'react';

export default function useFaviconBadge(unreadChannels) {
  const [visible, setVisible] = useState(true);
  const defaultFavicon = '/favicon.ico'; // Thay bằng favicon gốc
  const badgeFavicon = '/favicon-dot.ico'; // Thay bằng favicon có chấm đỏ

  const unreadCount = unreadChannels ? Object.keys(unreadChannels).length : 0;

  useEffect(() => {
    const favicon = document.querySelector("link[rel='icon']");
    if (!favicon) return;

    // Cập nhật favicon dựa vào `unreadChannels` và trạng thái nhấp nháy
    favicon.href = unreadCount > 0 && visible ? badgeFavicon : defaultFavicon;
    favicon.type = 'image/x-icon';
  }, [unreadCount, visible]);

  // Hiệu ứng nhấp nháy với tốc độ tùy chỉnh
  useEffect(() => {
    if (unreadCount === 0) return;

    const interval = setInterval(() => {
      setVisible(prev => !prev);
    }, 1000);

    return () => clearInterval(interval);
  }, [unreadCount]);
}
