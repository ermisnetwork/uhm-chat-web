import React, { useEffect, useState } from 'react';
import { alpha, IconButton, styled, useTheme, Zoom } from '@mui/material';
import { CaretDown } from 'phosphor-react';

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  right: '20px',
  bottom: '50px',
  zIndex: 1,
  backgroundColor: alpha(theme.palette.primary.main, 0.2),
  transition: 'all .2s',
}));

const ScrollToBottom = ({ showScrollBottom, handleScrollToBottom }) => {
  const theme = useTheme();

  return (
    <Zoom in={showScrollBottom}>
      <StyledIconButton size="large" onClick={handleScrollToBottom}>
        <CaretDown size={24} color={theme.palette.primary.main} />
      </StyledIconButton>
    </Zoom>
  );
};

export default ScrollToBottom;
