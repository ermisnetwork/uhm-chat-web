import { Stack, Typography, Button, useTheme } from '@mui/material';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PATH } from '@/config';
import NotFound404 from '@/assets/Illustration/NotFound404';
import SEOHead from '@/components/SEOHead';
import { useTranslation } from 'react-i18next';

const Page404 = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Stack spacing={2} sx={{ height: '100%', width: '100%' }} alignItems="center" justifyContent={'center'}>
      <SEOHead title={t('page404.title')} description={t('page404.message')} path="/404" noIndex />
      <NotFound404 />
      <Stack spacing={2}>
        <Typography variant="subtitle2" sx={{ fontSize: '32px', textAlign: 'center' }}>
          {t('page404.title')}
        </Typography>
        <Typography
          variant="subtitle2"
          sx={{ fontSize: '18px', textAlign: 'center', color: theme.palette.text.secondary }}
        >
          {t('page404.message')} <br /> {t('page404.message_detail')}
        </Typography>
        <Stack direction="row" spacing={1} justifyContent="center">
          <Button variant="contained" sx={{ textTransform: 'none' }} onClick={() => navigate(`${DEFAULT_PATH}`)}>
            {t('page404.go_home')}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
};

export default Page404;
