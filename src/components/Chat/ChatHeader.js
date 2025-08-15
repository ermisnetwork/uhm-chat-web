import React, { useState, useMemo } from 'react';
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
import { CaretLeft, MagnifyingGlass, Phone, VideoCamera } from 'phosphor-react';
import useResponsive from '../../hooks/useResponsive';
import { setSidebar, showSnackbar } from '../../redux/slices/app';
import { useDispatch, useSelector } from 'react-redux';
import ChannelAvatar from '../ChannelAvatar';
import { handleError, isChannelDirect, myRoleInChannel } from '../../utils/commons';
import {
  AvatarShape,
  CallType,
  ChatType,
  CurrentChannelStatus,
  RoleMember,
  SidebarType,
} from '../../constants/commons-const';
import { LoadingButton } from '@mui/lab';
import { setCurrentChannel, setCurrentChannelStatus, SetIsGuest } from '../../redux/slices/channel';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { callClient, client } from '../../client';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PATH } from '../../config';
import {
  DotsThreeIcon,
  EditIcon,
  InfoIcon,
  PauseCircleRedIcon,
  PinIcon,
  PlayCircleIcon,
  TrashIcon,
  UnPinIcon,
} from '../Icons';

const ActionsTopic = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const { currentChannel } = useSelector(state => state.channel);
  const { currentTopic } = useSelector(state => state.topic);
  const myRole = myRoleInChannel(currentChannel);

  const isTopicClosed = currentTopic?.data?.is_closed_topic;
  const isPinned = currentTopic?.data?.is_pinned;

  const onCloseTopic = async () => {
    try {
      const topicCID = currentTopic?.cid;
      await currentChannel.closeTopic(topicCID);
      setAnchorEl(null);
      dispatch(showSnackbar({ message: 'Topic closed successfully', severity: 'success' }));
    } catch (error) {
      handleError(dispatch, error);
    }
  };

  const onReopenTopic = async () => {
    try {
      const topicCID = currentTopic?.cid;
      await currentChannel.reopenTopic(topicCID);
      setAnchorEl(null);
      dispatch(showSnackbar({ message: 'Topic reopened successfully', severity: 'success' }));
    } catch (error) {
      handleError(dispatch, error);
    }
  };

  const onPinTopic = async () => {
    try {
      if (isPinned) {
        await client.unpinChannel(ChatType.TOPIC, currentTopic?.id);
      } else {
        await client.pinChannel(ChatType.TOPIC, currentTopic?.id);
      }
    } catch (error) {
      handleError(dispatch, error);
    } finally {
      setAnchorEl(null);
    }
  };

  const ACTIONS = [
    !isTopicClosed && {
      value: isPinned ? 'unpin' : 'pin',
      label: isPinned ? 'Unpin' : 'Pin To Top',
      icon: isPinned ? (
        <UnPinIcon color={theme.palette.text.primary} />
      ) : (
        <PinIcon color={theme.palette.text.primary} />
      ),
      onClick: onPinTopic,
    },
    {
      value: 'info',
      label: 'Topic Info',
      icon: <InfoIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
      },
    },
    !isTopicClosed && {
      value: 'edit',
      label: 'Edit Topic',
      icon: <EditIcon color={theme.palette.text.primary} />,
      onClick: () => {
        setAnchorEl(null);
        // dispatch(setSidebar({ type: SidebarType.SearchMessage, open: true }));
      },
      allowRoles: [RoleMember.OWNER, RoleMember.MOD],
    },
    {
      value: isTopicClosed ? 'reopen' : 'close',
      label: isTopicClosed ? 'Reopen Topic' : 'Close Topic',
      icon: isTopicClosed ? (
        <PlayCircleIcon color={theme.palette.text.primary} />
      ) : (
        <PauseCircleRedIcon color={theme.palette.text.primary} />
      ),
      onClick: isTopicClosed ? onReopenTopic : onCloseTopic,
      allowRoles: [RoleMember.OWNER, RoleMember.MOD],
    },
    {
      value: 'delete',
      label: 'Delete Topic',
      icon: <TrashIcon color={theme.palette.error.main} />,
      onClick: () => {
        setAnchorEl(null);
      },
      allowRoles: [RoleMember.OWNER, RoleMember.MOD],
    },
  ];

  return (
    <>
      <IconButton
        onClick={event => {
          setAnchorEl(event.currentTarget);
        }}
      >
        <DotsThreeIcon color={theme.palette.text.primary} />
      </IconButton>

      <Popover
        id={Boolean(anchorEl) ? 'actions-topic-popover' : undefined}
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
          {ACTIONS.filter(Boolean)
            .filter(action => !action.allowRoles || action.allowRoles.includes(myRole))
            .map((action, index) => (
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
                <ListItemText
                  primaryTypographyProps={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: action.value === 'delete' ? theme.palette.error.main : theme.palette.text.primary,
                  }}
                  primary={action.label}
                />
              </MenuItem>
            ))}
        </MenuList>
      </Popover>
    </>
  );
};

const ChatHeader = ({ currentChat }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isMobileToMd = useResponsive('down', 'md');
  const theme = useTheme();
  const { user_id } = useSelector(state => state.auth);
  const { isGuest, isBlocked } = useSelector(state => state.channel);
  const { currentTopic } = useSelector(state => state.topic);

  const isDirect = isChannelDirect(currentChat);
  const isEnabledTopics = currentChat?.data?.topics_enabled;

  const [loadingJoin, setLoadingJoin] = useState(false);

  const members = useMemo(() => (isDirect ? Object.values(currentChat.state.members) : []), [currentChat, isDirect]);

  const otherMember = useMemo(() => members.find(member => member.user_id !== user_id), [members, user_id]);

  const otherMemberId = otherMember?.user_id;

  const onlineStatus = useOnlineStatus(isDirect ? otherMemberId : '');

  const onStartCall = async callType => {
    await callClient.createCall(callType, currentChat.cid);
  };

  const onJoinChannel = async () => {
    try {
      setLoadingJoin(true);
      const response = await currentChat.acceptInvite('join');

      if (response) {
        setLoadingJoin(false);
        if (response.ermis_code) {
          dispatch(showSnackbar({ severity: 'error', message: response.message }));
        } else {
          // dispatch(FetchChannels());
          dispatch(SetIsGuest(false));
        }
      }
    } catch (error) {
      setLoadingJoin(false);
      handleError(dispatch, error);
    }
  };

  const renderName = () => {
    if (isEnabledTopics) {
      if (currentTopic) {
        return currentTopic.data?.name;
      } else {
        return 'General';
      }
    } else {
      return currentChat.data?.name;
    }
  };

  const renderCaption = () => {
    if (isEnabledTopics) {
      return currentChat.data?.name;
    } else {
      return isDirect ? onlineStatus : `${currentChat.data?.member_count} members`;
    }
  };

  const renderIconAction = () => {
    if (isGuest || isBlocked) return null;

    if (currentChat?.type === ChatType.TOPIC) {
      return <ActionsTopic />;
    } else {
      return (
        <IconButton
          onClick={() => {
            dispatch(setSidebar({ type: SidebarType.SearchMessage, open: true }));
          }}
        >
          <MagnifyingGlass />
        </IconButton>
      );
    }
  };

  return (
    <>
      <Box
        sx={{
          width: '100%',
          height: '74px',
          padding: '8px 16px',
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}
      >
        <Stack
          alignItems={'center'}
          direction={'row'}
          sx={{ width: '100%', height: '100%' }}
          justifyContent="space-between"
        >
          {currentChat ? (
            <Stack spacing={1} direction="row" alignItems="center" sx={{ flex: 1, overflow: 'hidden' }}>
              {isMobileToMd && (
                <IconButton
                  onClick={() => {
                    navigate(`${DEFAULT_PATH}`);
                    dispatch(setCurrentChannel(null));
                    dispatch(setCurrentChannelStatus(CurrentChannelStatus.IDLE));
                  }}
                >
                  <CaretLeft />
                </IconButton>
              )}

              <ChannelAvatar
                channel={currentChat}
                width={isEnabledTopics || currentTopic ? 40 : 60}
                height={isEnabledTopics || currentTopic ? 40 : 60}
                openLightbox={true}
                shape={AvatarShape.Round}
                showGeneralDefault={true}
              />

              <Box
                sx={{
                  overflow: 'hidden',
                  flex: 1,
                }}
              >
                <Button
                  onClick={() => {
                    if (!isGuest) {
                      dispatch(setSidebar({ type: SidebarType.Channel, open: true }));
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
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                  >
                    {renderName()}
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        color: theme.palette.text.secondary,
                        fontSize: '12px',
                        fontWeight: 400,
                      }}
                    >
                      {renderCaption()}
                    </Typography>
                  </Typography>
                </Button>
              </Box>
            </Stack>
          ) : (
            <span>&nbsp;</span>
          )}

          <Stack direction={'row'} alignItems="center" spacing={isMobileToMd ? 1 : 2}>
            {isDirect && (
              <>
                <IconButton onClick={() => onStartCall(CallType.VIDEO)} disabled={isBlocked}>
                  <VideoCamera />
                </IconButton>
                <IconButton onClick={() => onStartCall(CallType.AUDIO)} disabled={isBlocked}>
                  <Phone />
                </IconButton>
              </>
            )}

            {renderIconAction()}

            {isGuest && (
              <LoadingButton variant="contained" onClick={onJoinChannel} loading={loadingJoin}>
                Join
              </LoadingButton>
            )}
          </Stack>
        </Stack>
      </Box>
    </>
  );
};

export default ChatHeader;
