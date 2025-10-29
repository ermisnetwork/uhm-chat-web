import React, { useEffect, useMemo, useState } from 'react';
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
import { myRoleInChannel, splitChannelId } from '../../utils/commons';
import { AvatarShape, ChatType, RoleMember, SidebarType } from '../../constants/commons-const';
import { DotsThreeIcon, InfoIcon, ProfileAddIcon, SearchIcon, StickyNoteIcon } from '../../components/Icons';
import ChannelAvatar from '../../components/ChannelAvatar';
import NoTopic from '../../assets/Illustration/NoTopic';
import GeneralElement from '../../components/GeneralElement';
import NewTopicDialog from '../../sections/dashboard/NewTopicDialog';
import { SetOpenInviteFriendDialog, SetOpenNewTopicDialog } from '../../redux/slices/dialog';
import FlipMove from 'react-flip-move';
import TopicElement from '../../components/TopicElement';
import { ClientEvents } from '../../constants/events-const';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AddPinnedTopic,
  ConnectCurrentTopic,
  RemovePinnedTopic,
  SetCurrentTopic,
  SetOpenTopicPanel,
} from '../../redux/slices/topic';
import { setSidebar } from '../../redux/slices/app';
import { DEFAULT_PATH, TRANSITION } from '../../config';
import SkeletonChannels from '../../components/SkeletonChannels';
import { client } from '../../client';
import useResponsive from '../../hooks/useResponsive';
import { X } from 'phosphor-react';
import { useTranslation } from 'react-i18next';

const StyledTopicItem = styled(Box)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  margin: '0px -15px',
  padding: '5px 10px',
}));

const TopicEmpty = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const dispatch = useDispatch();
  const { parentChannel } = useSelector(state => state.topic);
  const myRole = myRoleInChannel(parentChannel);

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
        {t('topicPanel.topic_waiting')}
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
        {t('topicPanel.message')}
      </Typography>

      {[RoleMember.OWNER, RoleMember.MOD].includes(myRole) && (
        <Button
          variant="contained"
          size="large"
          sx={{ marginTop: 3, width: '200px' }}
          onClick={() => {
            dispatch(SetOpenNewTopicDialog(true));
          }}
        >
          {t('topicPanel.New_topic')}
        </Button>
      )}
    </Stack>
  );
};

const TopicHeader = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useDispatch();
  const isMobileToMd = useResponsive('down', 'md');
  const { isGuest } = useSelector(state => state.channel);
  const { parentChannel } = useSelector(state => state.topic);

  const [anchorEl, setAnchorEl] = useState(null);
  const myRole = myRoleInChannel(parentChannel);

  const ACTIONS = [
    {
      label: t('topicPanel.info_channel'),
      icon: <InfoIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        navigate(`${DEFAULT_PATH}/${parentChannel.cid}`);

        setTimeout(() => {
          dispatch(setSidebar({ type: SidebarType.Channel, open: true }));
        }, 100);
      },
    },
    {
      label: t('topicPanel.search'),
      icon: <SearchIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        dispatch(SetCurrentTopic(null));
        navigate(`${DEFAULT_PATH}/${parentChannel.cid}`);

        setTimeout(() => {
          dispatch(setSidebar({ type: SidebarType.SearchMessage, open: true }));
        }, 100);
      },
    },
    {
      label: t('topicPanel.add_member'),
      icon: <ProfileAddIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        navigate(`${DEFAULT_PATH}/${parentChannel.cid}`);

        setTimeout(() => {
          dispatch(SetOpenInviteFriendDialog(true));
        }, 100);
      },
    },
    {
      label: t('topicPanel.new_topic'),
      icon: <StickyNoteIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        navigate(`${DEFAULT_PATH}/${parentChannel.cid}`);

        setTimeout(() => {
          dispatch(SetOpenNewTopicDialog(true));
        }, 100);
      },
      allowRoles: [RoleMember.OWNER, RoleMember.MOD],
    },
  ];

  const onOpenPopover = event => {
    if (isMobileToMd) {
      setAnchorEl(event.currentTarget);
    }
  };

  const onCloseTopicPanel = () => {
    dispatch(SetOpenTopicPanel(false));
  };

  if (!parentChannel) return null;

  return (
    <Stack
      alignItems="center"
      direction="row"
      justifyContent="space-between"
      spacing={1}
      sx={{
        width: '100%',
        height: '65px',
        padding: '8px 6px',
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      <IconButton onClick={onCloseTopicPanel}>
        <X size={20} color={theme.palette.text.primary} />
      </IconButton>

      <Box sx={{ width: '50px', height: '50px' }} onClick={onOpenPopover}>
        <ChannelAvatar channel={parentChannel} width={50} height={50} openLightbox={true} shape={AvatarShape.Round} />
      </Box>

      <Box
        sx={{
          overflow: 'hidden',
          flex: 1,
          minWidth: 'auto',
        }}
      >
        <Button
          onClick={() => {
            if (!isGuest) {
              navigate(`${DEFAULT_PATH}/${parentChannel.cid}`);

              setTimeout(() => {
                dispatch(setSidebar({ type: SidebarType.Channel, open: true }));
              }, 100);
            }
          }}
          sx={{
            textTransform: 'none',
            maxWidth: '100%',
            minWidth: 'auto',
            justifyContent: 'start',
            textAlign: 'left',
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: theme.palette.text.primary,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
              overflow: 'hidden',
            }}
          >
            {parentChannel.data?.name}
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                color: theme.palette.text.secondary,
                fontSize: '12px',
                fontWeight: 400,
              }}
            >
              {`${parentChannel.data?.member_count} ${t('topicPanel.member')}`}
            </Typography>
          </Typography>
        </Button>
      </Box>

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
          {ACTIONS.filter(action => !action.allowRoles || action.allowRoles.includes(myRole)).map((action, index) => (
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
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { currentChannel } = useSelector(state => state.channel);
  const { currentTopic, topics, loadingTopics, pinnedTopics, openTopicPanel, parentChannel } = useSelector(
    state => state.topic,
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const topicID = searchParams.get('topicId');
  const [idSelected, setIdSelected] = useState('');

  useEffect(() => {
    const handleTopicPinned = event => {
      const splitParentCID = splitChannelId(event.parent_cid);
      const parentChannelId = splitParentCID.channelId;

      if (parentChannelId === parentChannel?.id && event.channel_type === ChatType.TOPIC) {
        dispatch(AddPinnedTopic(event.channel_id));
      }
    };

    const handleTopicUnPinned = event => {
      const splitParentCID = splitChannelId(event.parent_cid);
      const parentChannelId = splitParentCID.channelId;

      if (parentChannelId === parentChannel?.id && event.channel_type === ChatType.TOPIC) {
        dispatch(RemovePinnedTopic(event.channel_id));
      }
    };

    client.on(ClientEvents.ChannelPinned, handleTopicPinned);
    client.on(ClientEvents.ChannelUnPinned, handleTopicUnPinned);

    return () => {
      client.off(ClientEvents.ChannelPinned, handleTopicPinned);
      client.off(ClientEvents.ChannelUnPinned, handleTopicUnPinned);
    };
  }, [client, currentTopic, parentChannel]);

  useEffect(() => {
    if (topicID) {
      dispatch(ConnectCurrentTopic(topicID));
      setIdSelected(topicID);
    } else {
      dispatch(SetCurrentTopic(null));
      if (currentChannel) {
        setIdSelected(currentChannel.id);
      }
    }
  }, [topicID, currentChannel]);

  const renderedTopics = useMemo(() => {
    if (loadingTopics) {
      return <SkeletonChannels />;
    } else {
      return (
        <>
          <StyledTopicItem>
            <GeneralElement idSelected={idSelected} />
          </StyledTopicItem>

          {pinnedTopics.length > 0 && (
            <FlipMove duration={200}>
              {pinnedTopics.map(item => {
                return (
                  <StyledTopicItem key={`pinned-topic-${item.id}`}>
                    <TopicElement topic={item} idSelected={idSelected} />
                  </StyledTopicItem>
                );
              })}
            </FlipMove>
          )}

          {topics.length > 0 || pinnedTopics.length > 0 ? (
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
        </>
      );
    }
  }, [topics, idSelected, loadingTopics, pinnedTopics]);

  // if (!parentChannel?.data?.topics_enabled || !openTopicPanel) return null;

  return (
    <>
      <Stack
        sx={{
          width: openTopicPanel ? '300px' : '0px',
          height: openTopicPanel ? '100%' : '0px',
          borderLeft: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.mode === 'light' ? '#fff' : theme.palette.grey[900],
          borderRadius: '0 16px 16px 0',
          marginLeft: '0px!important',
          transition: TRANSITION,
          transform: openTopicPanel ? 'translateZ(0)' : 'translateZ(200px)',
          opacity: openTopicPanel ? 1 : 0,
        }}
      >
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
          {renderedTopics}
        </Stack>
      </Stack>

      <NewTopicDialog />
    </>
  );
};

export default TopicPanel;
