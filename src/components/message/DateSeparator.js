import React from 'react';
import { Box, Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const DateSeparator = React.memo(({ dateString }) => {
  const { t } = useTranslation();

  const getDateLabel = dateString => {
    const today = dayjs().startOf('day');
    const yesterday = today.subtract(1, 'day');

    const msgDate = dayjs(dateString).startOf('day');

    if (msgDate.isSame(today)) return t('chatComponent.today');
    if (msgDate.isSame(yesterday)) return t('chatComponent.yesterday');

    return msgDate.format('DD/MM/YYYY');
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
      <Chip size="small" label={getDateLabel(dateString)} />
    </Box>
  );
});

export default DateSeparator;
