import React from 'react';
import { Box } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import useResponsive from '../../hooks/useResponsive';
import LeftPanel from './LeftPanel';
import { WIDTH_LEFT_PANEL } from '../../config';
import { client } from '../../client';

const StyledChannelsBox = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '0px',
  left: '0px',
  zIndex: 1,
  width: '100%',
  height: '100%',
  transition: 'all .3s',
}));

const ClientsTabPanel = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { currentChannel } = useSelector(state => state.channel);

  const isDesktop = useResponsive('up', 'xl');
  const isScreenMdToXl = useResponsive('between', null, 'md', 'xl');
  const isMobileToMd = useResponsive('down', 'md');

  console.log(client);

  if (isMobileToMd && currentChannel) return null;

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          height: '100%',
          width: isDesktop ? `${WIDTH_LEFT_PANEL}px` : isScreenMdToXl ? '280px' : '100%',
          backgroundColor: theme.palette.mode === 'light' ? '#fff' : theme.palette.grey[900],
          borderRadius: '16px',
        }}
      >
        <StyledChannelsBox>
          <LeftPanel />
          {/* <Channels /> */}
        </StyledChannelsBox>
      </Box>
    </>
  );
};

export default ClientsTabPanel;
