import React, { useState } from 'react';
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { isPublicChannel } from '../../utils/commons';
import { setSidebar } from '../../redux/slices/app';
import { AvatarShape, SidebarType } from '../../constants/commons-const';
import { DotsThreeIcon, InfoIcon, ProfileAddIcon, SearchIcon, StickyNoteIcon } from '../../components/Icons';
import AvatarComponent from '../../components/AvatarComponent';
import ChannelAvatar from '../../components/ChannelAvatar';

const TopicHeader = () => {
  const theme = useTheme();
  const { currentChannel } = useSelector(state => state.channel);
  const isPublic = isPublicChannel(currentChannel);
  const [anchorEl, setAnchorEl] = useState(null);

  const ACTIONS = [
    {
      label: 'Channel Info',
      icon: <InfoIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        // Handle channel info action
        console.log('Channel Info clicked');
      },
    },
    {
      label: 'Search Messages',
      icon: <SearchIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        // Handle search messages action
        console.log('Search Messages clicked');
      },
    },
    {
      label: 'Add Members',
      icon: <ProfileAddIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        // Handle add members action
        console.log('Add Members clicked');
      },
    },
    {
      label: 'New Topic',
      icon: <StickyNoteIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        // Handle new topic action
        console.log('New Topic clicked');
      },
    },
  ];

  return (
    <Stack
      alignItems="center"
      direction="row"
      justifyContent="space-between"
      spacing={1}
      sx={{
        width: '100%',
        height: '74px',
        padding: '8px 16px',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      {isPublic ? (
        <AvatarComponent
          name={currentChannel.data?.name}
          url={currentChannel.data?.image || ''}
          width={60}
          height={60}
          isPublic={isPublic}
          openLightbox={true}
          shape={AvatarShape.Round}
        />
      ) : (
        <ChannelAvatar channel={currentChannel} width={60} height={60} openLightbox={true} shape={AvatarShape.Round} />
      )}

      <Typography
        variant="h6"
        sx={{
          color: theme.palette.text.primary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 'auto',
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {currentChannel.data?.name}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: theme.palette.text.secondary,
            fontSize: '12px',
            fontWeight: 400,
          }}
        >
          {`${currentChannel.data?.member_count} members`}
        </Typography>
      </Typography>

      <IconButton
        onClick={event => {
          setAnchorEl(event.currentTarget);
        }}
      >
        <DotsThreeIcon color={theme.palette.text.primary} />
      </IconButton>

      <Popover
        id={Boolean(anchorEl) ? 'actions-channel-popover' : undefined}
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => {
          setAnchorEl(null);
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuList sx={{ width: '210px' }}>
          {ACTIONS.map((action, index) => (
            <MenuItem
              key={index}
              onClick={action.onClick}
              sx={{
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 'auto!important', marginRight: '8px' }}>{action.icon}</ListItemIcon>
              <ListItemText primaryTypographyProps={{ fontSize: '14px', fontWeight: 600 }} primary={action.label} />
            </MenuItem>
          ))}
        </MenuList>
      </Popover>
    </Stack>
  );
};

const TopicPanel = () => {
  const theme = useTheme();
  const { currentChannel } = useSelector(state => state.channel);

  return (
    <Stack sx={{ width: '300px', height: '100%', borderRight: `1px solid ${theme.palette.divider}` }}>
      <TopicHeader />
    </Stack>
  );
};

export default TopicPanel;
