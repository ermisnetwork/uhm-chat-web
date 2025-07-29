import React, { useCallback, useEffect, useState } from 'react';
import { styled, useTheme } from '@mui/material/styles';
import { Box, Button, Divider, IconButton, Stack, Typography } from '@mui/material';
import {
  CaretRight,
  X,
  Users,
  Link,
  UserCircleGear,
  LockKey,
  MinusCircle,
  PencilSimple,
  ArrowLeft,
  SignOut,
  Trash,
  Prohibit,
  ProhibitInset,
  Funnel,
  Bell,
  BellSlash,
} from 'phosphor-react';
import useResponsive from '../../hooks/useResponsive';
import { useDispatch, useSelector } from 'react-redux';
import { ToggleSidebar, UpdateSidebarType, showSnackbar } from '../../redux/slices/app';
import ChannelAvatar from '../../components/ChannelAvatar';
import {
  checkDirectBlock,
  processImageFile,
  formatString,
  handleError,
  isChannelDirect,
  isPublicChannel,
  myRoleInChannel,
} from '../../utils/commons';
import { AvatarShape, ConfirmType, RoleMember, SidebarType } from '../../constants/commons-const';
import ClipboardCopy from '../../components/ClipboardCopy';
import { LoadingButton } from '@mui/lab';
import FormProvider from '../../components/hook-form/FormProvider';
import { RHFTextField, RHFUploadAvatar } from '../../components/hook-form';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { setChannelConfirm, SetOpenInviteFriendDialog } from '../../redux/slices/dialog';
import { ClientEvents } from '../../constants/events-const';
import RHFRadio from '../../components/hook-form/RHFRadio';
import AvatarComponent from '../../components/AvatarComponent';
import { DOMAIN_APP } from '../../config';
import AntSwitch from '../../components/AntSwitch';
import ChannelNotificationDialog from './ChannelNotificationDialog';
import { AddMutedChannel, RemoveMutedChannel } from '../../redux/slices/channel';
import useOnlineStatus from '../../hooks/useOnlineStatus';
import { BellIcon, LinkIcon, LogoutIcon, ProfileAddIcon, TrashIcon, UserOctagonIcon } from '../../components/Icons';
import ChannelInfoTab from './ChannelInfoTab';
import InviteFriendDialog from './InviteFriendDialog';

const StyledStackItem = styled(Stack)(({ theme }) => ({
  width: '100%',
  padding: '5px',
  '& .MuiTypography-root': {
    fontSize: '14px',
    fontWeight: 600,
  },
}));

const StyledActionItem = styled(Stack)(({ theme }) => ({
  width: '100%',
  borderRadius: '10px',
  transition: 'background-color 0.2s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  flexDirection: 'row',
  padding: '5px',
  gap: '8px',
  '&:hover': {
    cursor: 'pointer',
    backgroundColor: theme.palette.divider,
  },

  '& .MuiTypography-root': {
    fontSize: '14px',
    fontWeight: 600,
    minWidth: 'auto',
    overflow: 'hidden',
    flex: 1,
  },
}));

const EditChannel = ({ setIsEdit }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentChannel, isBlocked } = useSelector(state => state.channel);

  const [loadingButton, setLoadingButton] = useState(false);
  const [disabledButton, setDisabledButton] = useState(true);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const channelInfo = {
    name: formatString(currentChannel.data.name) || '',
    description: currentChannel.data.description || '',
    image: currentChannel.data?.image || '',
    public: String(currentChannel.data.public),
  };

  const NewGroupSchema = Yup.object().shape({
    name: Yup.string().trim().required('Channel name is required').max(255, 'Max 255 characters'),
    description: Yup.string().trim().max(255, 'Max 255 characters'),
  });

  const defaultValues = {
    name: channelInfo.name,
    description: channelInfo.description,
    image: channelInfo.image,
    public: String(channelInfo.public),
  };

  const methods = useForm({
    resolver: yupResolver(NewGroupSchema),
    mode: 'onChange',
    defaultValues,
  });

  const { watch, setValue, handleSubmit } = methods;

  const handleDrop = useCallback(
    async acceptedFiles => {
      const file = acceptedFiles[0];
      const isImage = file.type.startsWith('image/');

      if (!isImage) {
        dispatch(showSnackbar({ severity: 'error', message: 'Please upload an image file!' }));
      } else {
        const fileCompress = await processImageFile(file, true);

        if (fileCompress) {
          const newFile = Object.assign(fileCompress, {
            preview: URL.createObjectURL(fileCompress),
          });
          if (fileCompress) {
            setValue('image', newFile, { shouldValidate: true });
          }
        }
      }
    },
    [setValue],
  );

  const onSubmit = async data => {
    try {
      const { name, description, image } = data;
      const params = {};

      if (data.public !== defaultValues.public) {
        params.public = data.public === 'true';
      }

      if (name && name.trim() !== defaultValues.name.trim()) {
        params.name = name;
      }

      if (description.trim() !== defaultValues.description.trim()) {
        params.description = description;
      }

      if (typeof image === 'object' && image !== null) {
        const response = await currentChannel.sendFile(image);
        if (response) {
          params.image = response.file;
        }
      }

      setLoadingButton(true);
      await currentChannel.update(params);
      setLoadingButton(false);
      setUpdateSuccess(true);
    } catch (error) {
      setLoadingButton(false);
      setUpdateSuccess(false);
      handleError(dispatch, error);
    }
  };

  const watchValues = () => {
    const data = watch();

    return {
      name: data.name.trim(),
      description: data.description.trim(),
      image: data.image,
      public: data.public,
    };
  };

  useEffect(() => {
    const isImageObject = typeof watchValues().image === 'object';
    const noChanges = JSON.stringify(defaultValues) === JSON.stringify(watchValues());

    setDisabledButton((isImageObject && updateSuccess) || (!isImageObject && noChanges));
  }, [watchValues, defaultValues, updateSuccess]);

  return (
    <>
      <Box
        sx={{
          width: '100%',
          height: '74px',
        }}
      >
        <Stack
          sx={{ height: '100%' }}
          direction="row"
          alignItems={'center'}
          spacing={2}
          p={2}
          justifyContent="space-between"
        >
          <Stack direction="row" alignItems={'center'} spacing={2}>
            <IconButton
              onClick={() => {
                setIsEdit(false);
              }}
            >
              <ArrowLeft />
            </IconButton>
            <Typography variant="subtitle2" sx={{ flex: 1, textAlign: 'left' }}>
              Edit channel
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <Stack
        sx={{
          height: 'calc(100% - 74px)',
          position: 'relative',
          flexGrow: 1,
        }}
        spacing={2}
        p={2}
      >
        <Stack sx={{ width: '100%', height: '100%' }}>
          <FormProvider methods={methods} onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={3}>
              <RHFUploadAvatar name="image" onDrop={handleDrop} />
              <RHFRadio
                row
                name="public"
                options={[
                  { value: 'false', label: 'Private' },
                  { value: 'true', label: 'Public' },
                ]}
              />
              <RHFTextField name="name" label="Channel name" placeholder="Channel name" autoFocus />
              <RHFTextField multiline rows={4} name="description" label="Description" />
              <Stack direction={'row'} justifyContent={'center'}>
                <LoadingButton type="submit" variant="contained" loading={loadingButton} disabled={disabledButton}>
                  Save
                </LoadingButton>
              </Stack>
            </Stack>
          </FormProvider>
        </Stack>
      </Stack>
    </>
  );
};

const styleDescription = {
  display: '-webkit-box',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  WebkitLineClamp: 3,
  lineClamp: 3,
  WebkitBoxOrient: 'vertical',
  wordBreak: 'break-word',
};

const ChannelInfo = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { currentChannel, mutedChannels } = useSelector(state => state.channel);
  const { user_id } = useSelector(state => state.auth);
  const myRole = myRoleInChannel(currentChannel);
  const isDirect = isChannelDirect(currentChannel);
  const isPublic = isPublicChannel(currentChannel);

  const [otherMemberId, setOtherMemberId] = useState('');
  const [isEdit, setIsEdit] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [openDialogMuted, setOpenDialogMuted] = useState(false);
  const onlineStatus = useOnlineStatus(otherMemberId || '');

  useEffect(() => {
    if (currentChannel) {
      if (isDirect) {
        const members = Object.keys(currentChannel.state.members);
        const otherMemberId = members.find(member => member !== user_id);
        setOtherMemberId(otherMemberId);
      }

      setIsMuted(mutedChannels.some(item => item.id === currentChannel.id));

      setIsBlocked(checkDirectBlock(currentChannel));

      const handleMemberBlocked = event => {
        if (event.user.id === user_id) {
          setIsBlocked(true);
        }
      };

      const handleMemberUnBlocked = event => {
        if (event.user.id === user_id) {
          setIsBlocked(false);
        }
      };

      const handleMemberUpdated = event => {
        if (event.user.id === user_id) {
          const channelId = event.channel_id;
          if (event.member.muted) {
            dispatch(AddMutedChannel(event.cid));
            dispatch(showSnackbar({ severity: 'success', message: 'Notifications have been muted' }));
            setOpenDialogMuted(false);
            setIsMuted(true);
          } else {
            dispatch(RemoveMutedChannel(channelId));
            dispatch(showSnackbar({ severity: 'success', message: 'Notifications have been unmuted' }));
            setIsMuted(false);
          }
        }
      };

      currentChannel.on(ClientEvents.MemberBlocked, handleMemberBlocked);
      currentChannel.on(ClientEvents.MemberUnblocked, handleMemberUnBlocked);
      currentChannel.on(ClientEvents.MemberUpdated, handleMemberUpdated);

      return () => {
        currentChannel.off(ClientEvents.MemberBlocked, handleMemberBlocked);
        currentChannel.off(ClientEvents.MemberUnblocked, handleMemberUnBlocked);
        currentChannel.off(ClientEvents.MemberUpdated, handleMemberUpdated);
      };
    }
  }, [currentChannel, user_id, mutedChannels, isDirect]);

  const onChangeMute = async event => {
    const checked = event.target.checked;
    if (checked) {
      setOpenDialogMuted(true);
    } else {
      await currentChannel.unMuteNotification();
    }
  };

  const onToogleBlockUser = async () => {
    const payload = {
      openDialog: true,
      channel: currentChannel,
      userId: user_id,
      type: isBlocked ? ConfirmType.UNBLOCK : ConfirmType.BLOCK,
    };
    dispatch(setChannelConfirm(payload));
  };

  const onDeleteChat = () => {
    const payload = {
      openDialog: true,
      channel: currentChannel,
      userId: user_id,
      type: ConfirmType.DELETE,
    };
    dispatch(setChannelConfirm(payload));
  };

  const onLeaveChannel = () => {
    const payload = {
      openDialog: true,
      channel: currentChannel,
      userId: user_id,
      type: ConfirmType.LEAVE,
    };
    dispatch(setChannelConfirm(payload));
  };

  const onDeleteChannel = () => {
    const payload = {
      openDialog: true,
      channel: currentChannel,
      userId: user_id,
      type: ConfirmType.DELETE,
    };
    dispatch(setChannelConfirm(payload));
  };

  const onInviteFriend = () => {
    dispatch(SetOpenInviteFriendDialog(true));
  };

  const fullUrl = `${DOMAIN_APP}/channels/${currentChannel?.cid}`;
  const showItemMembers = !isDirect;
  const showItemAdministrators = !isDirect && myRole === RoleMember.OWNER;
  const showItemBanned = !isDirect && [RoleMember.OWNER, RoleMember.MOD].includes(myRole);
  const showItemPermissions = !isDirect && [RoleMember.OWNER, RoleMember.MOD].includes(myRole);
  const showEditChannel = !isDirect && [RoleMember.OWNER, RoleMember.MOD].includes(myRole);
  const showItemLeaveChannel = !isDirect && [RoleMember.MOD, RoleMember.MEMBER].includes(myRole);
  const showItemDeleteChannel = !isDirect && [RoleMember.OWNER].includes(myRole);
  const showItemDeleteChat = isDirect;
  const showItemKeywordFiltering = !isDirect && [RoleMember.OWNER, RoleMember.MOD].includes(myRole);
  const showItemBlockUser = isDirect;
  const showItemInviteFriend = !isDirect;

  if (!currentChannel) return null;

  return (
    <>
      {isEdit ? (
        <EditChannel setIsEdit={setIsEdit} />
      ) : (
        <Stack sx={{ width: '100%', height: '100%', position: 'relative' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ padding: '10px 15px' }}>
            <IconButton
              onClick={() => {
                dispatch(ToggleSidebar());
              }}
            >
              <X size={20} color={theme.palette.text.primary} />
            </IconButton>

            {showEditChannel && (
              <IconButton onClick={() => setIsEdit(true)}>
                <PencilSimple size={20} color={theme.palette.text.primary} />
              </IconButton>
            )}
          </Stack>

          <Stack
            className="customScrollbar"
            sx={{
              overflowY: 'auto',
              width: '100%',
              height: '100%',
              position: 'relative',
              padding: '0 24px 24px',
            }}
            spacing={3}
          >
            <Stack alignItems="center" direction="column" spacing={1}>
              {/* --------------------avatar-------------------- */}
              <>
                {isPublic ? (
                  <AvatarComponent
                    name={currentChannel.data?.name}
                    url={currentChannel.data?.image || ''}
                    width={130}
                    height={130}
                    isPublic={isPublic}
                    openLightbox={true}
                    shape={AvatarShape.Round}
                  />
                ) : (
                  <ChannelAvatar
                    channel={currentChannel}
                    width={130}
                    height={130}
                    openLightbox={true}
                    shape={AvatarShape.Round}
                  />
                )}
              </>
              {/* --------------------channel name-------------------- */}
              <Typography
                variant="subtitle2"
                sx={{
                  width: '100%',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontSize: '18px',
                  fontWeight: 600,
                  textAlign: 'center',
                }}
                title={currentChannel.data.name}
              >
                {currentChannel.data.name}
              </Typography>
              {/* --------------------onlineStatus or member_count-------------------- */}
              <Typography
                variant="caption"
                sx={{
                  color: theme.palette.text.secondary,
                  fontSize: '14px',
                  textAlign: 'center',
                  marginTop: '0px !important',
                }}
              >
                {isDirect ? onlineStatus : `${currentChannel.data.member_count} members`}
              </Typography>
              {/* --------------------channel description-------------------- */}
              {!isDirect && currentChannel.data.description && (
                <Typography style={{ fontSize: '16px', textAlign: 'center', ...styleDescription }}>
                  {currentChannel.data.description}
                </Typography>
              )}
              {/* --------------------public URL or user ID-------------------- */}
              {(isPublic || otherMemberId) && (
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  spacing={1}
                  sx={{
                    borderRadius: '8px',
                    padding: '10px',
                    backgroundColor: theme.palette.background.neutral,
                    width: '100%',
                    marginTop: '20px !important',
                  }}
                >
                  <LinkIcon color={theme.palette.text.primary} />
                  <Typography
                    title={isPublic ? fullUrl : otherMemberId}
                    sx={{
                      minWidth: 'auto',
                      overflow: 'hidden',
                      flex: 1,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      fontSize: '14px',
                      color: theme.palette.text.primary,
                    }}
                  >
                    {isPublic ? fullUrl : otherMemberId}
                  </Typography>
                  <ClipboardCopy text={isPublic ? fullUrl : otherMemberId} />
                </Stack>
              )}
            </Stack>

            <Stack spacing={2}>
              {/* ------------Mute Notifications--------------- */}
              <StyledStackItem direction="row" alignItems="center" justifyContent={'space-between'}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <BellIcon color={theme.palette.text.primary} />
                  <Typography variant="subtitle2">{isMuted ? 'Unmute' : 'Mute'} Notifications</Typography>
                </Stack>

                <AntSwitch onChange={onChangeMute} checked={isMuted} />
              </StyledStackItem>

              {/* ------------Invite Friend--------------- */}
              {showItemInviteFriend && (
                <StyledActionItem onClick={onInviteFriend}>
                  <ProfileAddIcon color={theme.palette.text.primary} />
                  <Typography variant="subtitle2" color={theme.palette.text.primary}>
                    Invite Friend
                  </Typography>
                </StyledActionItem>
              )}

              {/* ------------Block User--------------- */}
              {showItemBlockUser && (
                <StyledActionItem onClick={onToogleBlockUser}>
                  <UserOctagonIcon color={theme.palette.text.primary} colorUser={theme.palette.error.main} />
                  <Typography variant="subtitle2" color={theme.palette.error.main}>
                    {isBlocked ? 'Unblock User' : 'Block User'}
                  </Typography>
                </StyledActionItem>
              )}

              {/* ------------Delete chat--------------- */}
              {showItemDeleteChat && (
                <StyledActionItem onClick={onDeleteChat}>
                  <TrashIcon color={theme.palette.text.primary} />
                  <Typography variant="subtitle2" color={theme.palette.error.main}>
                    Delete chat
                  </Typography>
                </StyledActionItem>
              )}

              {/* ------------Leave channel--------------- */}
              {showItemLeaveChannel && (
                <StyledActionItem onClick={onLeaveChannel}>
                  <LogoutIcon color={theme.palette.text.primary} />
                  <Typography variant="subtitle2" color={theme.palette.error.main}>
                    Leave channel
                  </Typography>
                </StyledActionItem>
              )}

              {/* ------------Delete channel--------------- */}
              {showItemDeleteChannel && (
                <StyledActionItem onClick={onDeleteChannel}>
                  <TrashIcon color={theme.palette.text.primary} />
                  <Typography variant="subtitle2" color={theme.palette.error.main}>
                    Delete channel
                  </Typography>
                </StyledActionItem>
              )}

              {/* ------------Permissions--------------- */}
              {/* {showItemPermissions && (
                <>
                  <StyledStackItem direction="row" alignItems="center" justifyContent={'space-between'}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <UserCircleGear size={21} />

                      <Typography variant="subtitle2">Permissions</Typography>
                    </Stack>
                    <IconButton
                      onClick={() => {
                        dispatch(UpdateSidebarType(SidebarType.Permissions));
                      }}
                    >
                      <CaretRight />
                    </IconButton>
                  </StyledStackItem>
                  <StyledDivider />
                </>
              )} */}

              {/* ------------Administrators--------------- */}
              {/* {showItemAdministrators && (
                <>
                  <StyledStackItem direction="row" alignItems="center" justifyContent={'space-between'}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <LockKey size={21} />

                      <Typography variant="subtitle2">Administrators</Typography>
                    </Stack>
                    <IconButton
                      onClick={() => {
                        dispatch(UpdateSidebarType(SidebarType.Administrators));
                      }}
                    >
                      <CaretRight />
                    </IconButton>
                  </StyledStackItem>
                  <StyledDivider />
                </>
              )} */}

              {/* ------------Banned members--------------- */}
              {/* {showItemBanned && (
                <>
                  <StyledStackItem direction="row" alignItems="center" justifyContent={'space-between'}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <MinusCircle size={21} color="red" />

                      <Typography variant="subtitle2">Banned members</Typography>
                    </Stack>
                    <IconButton
                      onClick={() => {
                        dispatch(UpdateSidebarType(SidebarType.BannedUsers));
                      }}
                    >
                      <CaretRight />
                    </IconButton>
                  </StyledStackItem>
                  <StyledDivider />
                </>
              )} */}

              {/* ------------Keyword filtering--------------- */}
              {/* {showItemKeywordFiltering && (
                <>
                  <StyledStackItem direction="row" alignItems="center" justifyContent={'space-between'}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Funnel size={21} />
                      <Typography variant="subtitle2">Keyword filtering</Typography>
                    </Stack>
                    <IconButton
                      onClick={() => {
                        dispatch(UpdateSidebarType(SidebarType.KeywordFiltering));
                      }}
                    >
                      <CaretRight />
                    </IconButton>
                  </StyledStackItem>
                  <StyledDivider />
                </>
              )} */}
            </Stack>

            {/* ------------Channel info tab--------------- */}
            <Stack>
              <ChannelInfoTab />
            </Stack>
          </Stack>
        </Stack>
      )}

      <ChannelNotificationDialog openDialogMuted={openDialogMuted} setOpenDialogMuted={setOpenDialogMuted} />
      <InviteFriendDialog />
    </>
  );
};

export default ChannelInfo;
