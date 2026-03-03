import React from 'react';
import { Box, Typography } from '@mui/material';

const EndOfMessages = React.memo(() => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      px: 4,
      pt: 2,
      pb: 3,
      animation: 'fadeIn 0.5s ease-in-out',
      '@keyframes fadeIn': {
        from: { opacity: 0, transform: 'translateY(-8px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
      },
    }}
  >
    <Box
      sx={{
        flex: 1,
        height: '1px',
        background: theme => `linear-gradient(to left, ${theme.palette.divider}, transparent)`,
      }}
    />
    <Typography
      variant="body2"
      sx={{
        color: 'text.disabled',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        letterSpacing: '0.3px',
      }}
    >
      Đã tải hết tin nhắn cũ
    </Typography>
    <Box
      sx={{
        flex: 1,
        height: '1px',
        background: theme => `linear-gradient(to right, ${theme.palette.divider}, transparent)`,
      }}
    />
  </Box>
));

export default EndOfMessages;
