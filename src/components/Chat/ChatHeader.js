import React, { useState, useMemo } from 'react';
import { Box, Button, IconButton, Stack, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CaretLeft, MagnifyingGlass, Phone, VideoCamera } from 'phosphor-react';
import useResponsive from '../../hooks/useResponsive';
import { setSidebar, showSnackbar } from '../../redux/slices/app';
import { useDispatch, useSelector } from 'react-redux';
import ChannelAvatar from '../ChannelAvatar';
import { handleError, isChannelDirect, isPublicChannel } from '../../utils/commons';
import { AvatarShape, CallType, CurrentChannelStatus, SidebarType } from '../../constants/commons-const';
import { LoadingButton } from '@mui/lab';
import { setCurrentChannel, setCurrentChannelStatus, SetIsGuest } from '../../redux/slices/channel';
import AvatarComponent from '../AvatarComponent';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { callClient } from '../../client';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_PATH } from '../../config';
import AvatarGeneralDefault from '../AvatarGeneralDefault';
import TopicAvatar from '../TopicAvatar';
import { DotsThreeIcon } from '../Icons';

const ChatHeader = ({ currentChannel, isBlocked }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const isMobileToMd = useResponsive('down', 'md');
  const theme = useTheme();
  const { user_id } = useSelector(state => state.auth);
  const { isGuest } = useSelector(state => state.channel);
  const { currentTopic } = useSelector(state => state.topic);

  const isDirect = isChannelDirect(currentChannel);
  const isPublic = isPublicChannel(currentChannel);
  const isEnabledTopics = currentChannel?.data?.topics_enabled;

  const [loadingJoin, setLoadingJoin] = useState(false);

  const members = useMemo(
    () => (isDirect ? Object.values(currentChannel.state.members) : []),
    [currentChannel, isDirect],
  );

  const otherMember = useMemo(() => members.find(member => member.user_id !== user_id), [members, user_id]);

  const otherMemberId = otherMember?.user_id;

  const onlineStatus = useOnlineStatus(isDirect ? otherMemberId : '');

  const onStartCall = async callType => {
    await callClient.createCall(callType, currentChannel.cid);
  };

  const onJoinChannel = async () => {
    try {
      setLoadingJoin(true);
      const response = await currentChannel.acceptInvite('join');

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

  const renderAvatar = () => {
    if (isEnabledTopics) {
      return (
        <>
          {currentTopic ? (
            <TopicAvatar
              url={currentTopic.data?.image || ''}
              name={currentTopic.data?.name || ''}
              size={40}
              shape={AvatarShape.Round}
            />
          ) : (
            <AvatarGeneralDefault size={40} />
          )}
        </>
      );
    } else {
      return (
        <>
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
            <ChannelAvatar
              channel={currentChannel}
              width={60}
              height={60}
              openLightbox={true}
              shape={AvatarShape.Round}
            />
          )}
        </>
      );
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
      return currentChannel.data?.name;
    }
  };

  const renderCaption = () => {
    if (isEnabledTopics) {
      return currentChannel.data?.name;
    } else {
      return isDirect ? onlineStatus : `${currentChannel.data?.member_count} members`;
    }
  };

  const renderIconAction = () => {
    if (isEnabledTopics) {
      return (
        <IconButton>
          <DotsThreeIcon color={theme.palette.text.primary} />
        </IconButton>
      );
    } else {
      if (!isGuest && !isBlocked) {
        return (
          <IconButton
            onClick={() => {
              dispatch(setSidebar({ type: SidebarType.SearchMessage, open: true }));
            }}
          >
            <MagnifyingGlass />
          </IconButton>
        );
      } else {
        return null;
      }
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
          {currentChannel ? (
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

              {renderAvatar()}

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
