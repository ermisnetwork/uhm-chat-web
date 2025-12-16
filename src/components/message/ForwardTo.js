import { Typography, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { MessageType } from '../../constants/commons-const';
import { ArrowBendUpRight } from 'phosphor-react';

const ForwardTo = ({ type, isMyMessage }) => {
  const { t } = useTranslation();
  const theme = useTheme();

  const isSticker = type === MessageType.Sticker;
  const color = isMyMessage ? theme.palette.grey[200] : theme.palette.grey[500];

  return (
    <Typography
      variant="subtitle2"
      sx={{
        fontSize: '12px',
        color: isSticker ? '#bdbdbd' : color,
        fontWeight: 400,
      }}
    >
      <ArrowBendUpRight size={14} weight="fill" color={color} />
      &nbsp;{t('conversation.forwarded_message')}{' '}
    </Typography>
  );
};

export default ForwardTo;
