import { Box, useTheme, Typography } from '@mui/material';

export default function ClosedTopicBackdrop() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        width: '100%',
        height: '77px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '0px 24px',
      }}
    >
      <Typography
        variant="body1"
        sx={{ color: theme.palette.error.main, fontWeight: 600, textAlign: 'center', fontSize: '14px' }}
      >
        THIS TOPIC IS CLOSED
      </Typography>
    </Box>
  );
}
