import React from 'react';
import { Box, Stack, styled, Typography, useTheme } from '@mui/material';
import { Navigate, Outlet } from 'react-router-dom';

import Logo from '../../assets/Images/logo-demo.png';
import { useSelector } from 'react-redux';
import { DEFAULT_PATH } from '../../config';
import useResponsive from '../../hooks/useResponsive';
import { SlideLogin1, SlideLogin2, SlideLogin3 } from '../../components/Icons';
import Slider from 'react-slick';
import { useTranslation } from 'react-i18next';

const StyledSlider = styled(Slider)(({ theme }) => ({
  width: '100%',
  padding: '0px 15px',
  '& .slick-dots': {
    bottom: '0px',
    '& li': {
      width: 'auto',
      height: 'auto',

      '&.slick-active': {
        '& button': {
          width: '17px',
          borderRadius: '16px',
          backgroundColor: theme.palette.primary.main,
        },
      },

      '& button': {
        width: '6px',
        height: '6px',
        backgroundColor: theme.palette.background.neutral,
        borderRadius: '50%',
        transition: 'all 0.3s ease',
      },

      '& button:before': {
        display: 'none',
      },
    },
  },
}));

const AuthLayout = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { isLoggedIn } = useSelector(state => state.auth);
  const isScreenMdToXl = useResponsive('between', null, 'md', 'xl');
  const isMobileToMd = useResponsive('down', 'md');
  const imageSize = isMobileToMd ? 200 : isScreenMdToXl ? 350 : 520;

  if (isLoggedIn) {
    return <Navigate to={DEFAULT_PATH} />;
  }

  const SLIDE = [
    {
      title: 'index_login.title_one',
      description: 'index_login.description_one',
      image: <SlideLogin1 style={{ margin: 'auto' }} size={imageSize} />,
    },
    {
      title: 'index_login.title_two',
      description: 'index_login.description_two',
      image: <SlideLogin2 style={{ margin: 'auto' }} size={imageSize} />,
    },
    {
      title: 'index_login.title_three',
      description: 'index_login.description_three',
      image: <SlideLogin3 style={{ margin: 'auto' }} size={imageSize} />,
    },
  ];

  const sliderSettings = {
    dots: true,
    fade: true,
    infinite: true,
    speed: 500,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
  };

  return (
    <Stack direction="row" gap={3} sx={{ height: '100%', width: '100%' }}>
      {/* ---------------------lEFT--------------------- */}
      {!isMobileToMd && (
        <Stack sx={{ width: '50%', height: '100%', justifyContent: 'center' }}>
          <StyledSlider {...sliderSettings}>
            {SLIDE.map((slide, idx) => (
              <Box key={idx} sx={{ textAlign: 'center', cursor: 'pointer' }}>
                <Typography variant="h2" sx={{ marginBottom: '5px' }}>
                  {t(slide.title)}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontSize: '18px', fontWeight: 400, margin: '0 auto 30px' }}
                >
                  {t(slide.description)
                    .split('\n')
                    .map((line, idx) => (
                      <React.Fragment key={idx}>
                        {line}
                        <br />
                      </React.Fragment>
                    ))}
                </Typography>
                {slide.image}
              </Box>
            ))}
          </StyledSlider>
        </Stack>
      )}
      {/* ---------------------RIGHT--------------------- */}
      <Stack
        sx={{
          width: isMobileToMd ? '100%' : '50%',
          backgroundColor: theme.palette.grey[100],
          padding: '60px 15px 15px',
        }}
        alignItems="center"
      >
        {/* ---------------------LOGO--------------------- */}
        <Stack sx={{ width: '100%', marginBottom: '30px' }} direction="column" alignItems={'center'}>
          <img style={{ height: 220, width: 230 }} src={Logo} alt="Logo" />
        </Stack>
        <Outlet />
      </Stack>
    </Stack>
  );
};

export default AuthLayout;
