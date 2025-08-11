import React, { useEffect, useState } from 'react';
import {
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  MenuList,
  Popover,
  Stack,
  Typography,
  Box,
  styled,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDispatch, useSelector } from 'react-redux';
import { splitChannelId } from '../../utils/commons';
import { AvatarShape, SidebarType } from '../../constants/commons-const';
import { DotsThreeIcon, InfoIcon, ProfileAddIcon, SearchIcon, StickyNoteIcon } from '../../components/Icons';
import ChannelAvatar from '../../components/ChannelAvatar';
import NoTopic from '../../assets/Illustration/NoTopic';
import GeneralElement from '../../components/GeneralElement';
import NewTopicDialog from '../../sections/dashboard/NewTopicDialog';
import { SetOpenNewTopicDialog } from '../../redux/slices/dialog';
import FlipMove from 'react-flip-move';
import TopicElement from '../../components/TopicElement';
import { ClientEvents } from '../../constants/events-const';
import { WatchCurrentChannel } from '../../redux/slices/channel';
import { useSearchParams } from 'react-router-dom';
import { ConnectCurrentTopic, SetCurrentTopic } from '../../redux/slices/topic';
import { setSidebar } from '../../redux/slices/app';

const StyledTopicItem = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  margin: '0px -15px',
  padding: '5px 10px',
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const TopicEmpty = () => {
  const theme = useTheme();
  const dispatch = useDispatch();

  return (
    <Stack sx={{ flex: 1, width: '100%', minHeight: 'auto', alignItems: 'center', justifyContent: 'center' }}>
      <NoTopic />
      <Typography
        variant="subtitle2"
        sx={{
          textAlign: 'center',
          fontSize: 16,
          color: theme.palette.text.primary,
          fontWeight: 600,
          marginTop: 2,
        }}
      >
        Topic Is Waiting!
      </Typography>
      <Typography
        variant="subtitle2"
        sx={{
          textAlign: 'center',
          fontSize: 14,
          color: theme.palette.text.secondary,
          fontWeight: 400,
        }}
      >
        We moved older messages to “General.” Kick off a new topic anytime!
      </Typography>

      <Button
        variant="contained"
        size="large"
        sx={{ marginTop: 3, width: '200px' }}
        onClick={() => {
          dispatch(SetOpenNewTopicDialog(true));
        }}
      >
        NEW TOPIC
      </Button>
    </Stack>
  );
};

const TopicHeader = () => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentChannel } = useSelector(state => state.channel);
  const [anchorEl, setAnchorEl] = useState(null);

  const ACTIONS = [
    {
      label: 'Channel Info',
      icon: <InfoIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        dispatch(setSidebar({ type: SidebarType.Channel, open: true }));
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
        dispatch(SetOpenNewTopicDialog(true));
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
      <ChannelAvatar channel={currentChannel} width={60} height={60} openLightbox={true} shape={AvatarShape.Round} />

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
  const dispatch = useDispatch();
  const theme = useTheme();
  const { currentChannel } = useSelector(state => state.channel);
  const { currentTopic } = useSelector(state => state.topic);
  const topics = currentChannel?.state?.topics || [];
  const [searchParams] = useSearchParams();
  const topicID = searchParams.get('topicId');
  const [idSelected, setIdSelected] = useState('');

  useEffect(() => {
    console.log('--currentChannel--', currentChannel);
    const handleChannelTopicCreated = event => {
      const splitCID = splitChannelId(event.cid);
      const channelId = splitCID.channelId;
      const channelType = splitCID.channelType;
      dispatch(WatchCurrentChannel(channelId, channelType));
    };

    currentChannel.on(ClientEvents.ChannelTopicCreated, handleChannelTopicCreated);
    return () => {
      currentChannel.off(ClientEvents.ChannelTopicCreated, handleChannelTopicCreated);
    };
  }, [currentChannel]);

  useEffect(() => {
    if (topicID) {
      dispatch(ConnectCurrentTopic(topicID));
      setIdSelected(topicID);
    } else {
      dispatch(SetCurrentTopic(null));
      setIdSelected(currentChannel.id);
    }
  }, [topicID, currentChannel]);

  useEffect(() => {
    console.log('--currentTopic--', currentTopic);
  }, [currentTopic]);

  if (!currentChannel?.data?.topics_enabled) return null;

  return (
    <>
      <Stack sx={{ width: '300px', height: '100%', borderRight: `1px solid ${theme.palette.divider}` }}>
        <TopicHeader />

        <Stack
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 'auto',
            padding: '0 15px',
          }}
          className="customScrollbar"
        >
          <StyledTopicItem key={`topic-general`}>
            <GeneralElement idSelected={idSelected} />
          </StyledTopicItem>

          {topics.length > 0 ? (
            <FlipMove duration={200}>
              {topics.map(item => {
                return (
                  <StyledTopicItem key={`topic-${item.id}`}>
                    <TopicElement topic={item} idSelected={idSelected} />
                  </StyledTopicItem>
                );
              })}
            </FlipMove>
          ) : (
            <TopicEmpty />
          )}
        </Stack>
      </Stack>

      <NewTopicDialog />
    </>
  );
};

export default TopicPanel;
