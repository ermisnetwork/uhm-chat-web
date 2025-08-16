import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { IconButton, InputAdornment, Stack, Typography, Box, Button } from '@mui/material';
import { CaretRight, X } from 'phosphor-react';
import { useDispatch, useSelector } from 'react-redux';
import { ToggleSidebar, setSidebar, showSnackbar } from '../../redux/slices/app';
import ChannelAvatar from '../../components/ChannelAvatar';
import { processImageFile, handleError, myRoleInChannel } from '../../utils/commons';
import { AvatarShape, ChatType, RoleMember, SidebarMode, SidebarType } from '../../constants/commons-const';
import { LoadingButton } from '@mui/lab';
import FormProvider from '../../components/hook-form/FormProvider';
import { RHFTextField, RHFUploadAvatar } from '../../components/hook-form';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import { EditIcon, EditOctagonIcon, UsersIcon } from '../../components/Icons';
import ChannelInfoTab from './ChannelInfoTab';

const FormTopicInfo = ({ formSubmitRef, setSaveDisabled, setSaveLoading }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { currentChannel } = useSelector(state => state.channel);
  const { currentTopic } = useSelector(state => state.topic);
  const { sideBar } = useSelector(state => state.app);
  const isModeEdit = sideBar?.mode === SidebarMode.Edit;

  const isEmoji = currentTopic?.data?.image && currentTopic?.data?.image.startsWith('emoji://');
  const image = !isEmoji ? currentTopic?.data?.image : '';

  const channelInfo = {
    name: currentTopic?.data?.name || '',
    description: currentTopic?.data?.description || '',
    image: image,
  };

  const NewGroupSchema = Yup.object().shape({
    name: Yup.string().trim().required('Channel name is required').max(255, 'Max 255 characters'),
  });

  const defaultValues = {
    image: channelInfo.image,
    name: channelInfo.name,
    description: channelInfo.description,
  };

  const methods = useForm({
    resolver: yupResolver(NewGroupSchema),
    mode: 'onChange',
    defaultValues,
  });

  const { watch, setValue, handleSubmit } = methods;
  const description = watch('description', '');
  const wordCount = description ? description.trim().length : 0;

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
      const topicCID = currentTopic?.cid;
      const { name, description, image } = data;
      const params = {};

      if (name && name.trim() !== defaultValues.name.trim()) {
        params.name = name;
      }

      if (description.trim() !== defaultValues.description.trim()) {
        params.description = description;
      }

      if (typeof image === 'object' && image !== null) {
        setSaveLoading(true);
        const response = await currentTopic.sendFile(image);
        if (response) {
          params.image = response.file;
        }
      }

      setSaveLoading(true);
      await currentChannel.editTopic(topicCID, params);
      dispatch(showSnackbar({ severity: 'success', message: 'Channel updated successfully' }));
    } catch (error) {
      handleError(dispatch, error);
    } finally {
      setSaveLoading(false);
      dispatch(setSidebar({ type: SidebarType.TopicInfo, open: true, mode: '' }));
    }
  };

  const watchValues = () => {
    const data = watch();

    return {
      name: data.name.trim(),
      description: data.description.trim(),
      image: data.image,
    };
  };

  useEffect(() => {
    if (formSubmitRef) {
      formSubmitRef.current = handleSubmit(onSubmit);
    }
  }, [formSubmitRef, handleSubmit, onSubmit]);

  useEffect(() => {
    const noChanges =
      watchValues().name === defaultValues.name &&
      watchValues().description === defaultValues.description &&
      ((typeof defaultValues.image === 'string' &&
        typeof watchValues().image === 'string' &&
        watchValues().image === defaultValues.image) ||
        (typeof defaultValues.image === 'object' && typeof watchValues().image === 'object'));

    setSaveDisabled(noChanges);
  }, [watchValues, defaultValues]);

  const onOpenChannelInfo = () => {
    dispatch(setSidebar({ type: SidebarType.Channel, open: true, mode: '' }));
  };

  if (!isModeEdit) {
    return (
      <Stack gap={1} alignItems="center">
        <Stack direction="row" alignItems="center" justifyContent="center" gap={1}>
          <ChannelAvatar channel={currentTopic} width={60} height={60} openLightbox={true} shape={AvatarShape.Round} />
          <Box sx={{ flex: 1, minWidth: 'auto', overflow: 'hidden' }}>
            {/* --------------------topic name-------------------- */}
            <Typography
              variant="subtitle2"
              sx={{
                width: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: '18px',
                fontWeight: 600,
              }}
              title={channelInfo?.name}
            >
              {channelInfo?.name}
            </Typography>
            {/* --------------------channel name-------------------- */}
            <Button
              variant="text"
              endIcon={<CaretRight size={16} color={theme.palette.text.secondary} />}
              sx={{
                padding: '0px',
                fontSize: '14px',
                color: theme.palette.text.secondary,
                fontWeight: 400,
                '&:hover': {
                  backgroundColor: 'transparent',
                  color: theme.palette.text.primary,
                  textDecoration: 'underline',
                },
              }}
              onClick={onOpenChannelInfo}
            >
              {currentChannel?.data?.name || ''}
            </Button>
          </Box>
        </Stack>

        {/* --------------------channel description-------------------- */}
        {currentTopic?.data?.description && (
          <Typography style={{ fontSize: '16px', textAlign: 'center', ...styleDescription }}>
            {channelInfo?.description}
          </Typography>
        )}
      </Stack>
    );
  }

  return (
    <>
      <Stack sx={{ width: '100%' }}>
        <FormProvider methods={methods} onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={1} alignItems="center" direction="column">
            {/* --------------------avatar-------------------- */}
            <RHFUploadAvatar name="image" onDrop={handleDrop} />

            <Stack spacing={2} sx={{ width: '100%' }}>
              <RHFTextField
                name="name"
                placeholder="Channel name"
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <UsersIcon color={theme.palette.text.primary} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    borderRadius: '16px',
                  },
                }}
              />

              <RHFTextField
                multiline
                rows={4}
                name="description"
                placeholder="Description"
                inputProps={{
                  maxLength: 100,
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EditIcon color={theme.palette.text.primary} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiInputBase-root': {
                    borderRadius: '16px',
                    alignItems: 'baseline',
                  },
                  '& .MuiFormHelperText-root': {
                    textAlign: 'right',
                    marginRight: '0px',
                  },
                }}
                helperText={`${wordCount}/100 words`}
              />
            </Stack>
          </Stack>
        </FormProvider>
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

const SidebarTopicInfo = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const formSubmitRef = useRef(null);
  const { currentChannel } = useSelector(state => state.channel);
  const { currentTopic } = useSelector(state => state.topic);
  const { sideBar } = useSelector(state => state.app);
  const myRole = myRoleInChannel(currentChannel);

  const [saveDisabled, setSaveDisabled] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const isModeEdit = sideBar?.mode === SidebarMode.Edit;

  const onEditing = () => {
    dispatch(setSidebar({ type: SidebarType.TopicInfo, open: true, mode: SidebarMode.Edit }));
  };

  const onSaveClick = () => {
    if (formSubmitRef.current) formSubmitRef.current();
  };

  const showEditTopic = currentChannel?.type === ChatType.TEAM && [RoleMember.OWNER, RoleMember.MOD].includes(myRole);

  if (!currentTopic) return null;

  return (
    <Stack sx={{ width: '100%', height: '100%', position: 'relative' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ padding: '10px 15px' }}>
        <IconButton
          onClick={() => {
            dispatch(ToggleSidebar());
          }}
        >
          <X size={20} color={theme.palette.text.primary} />
        </IconButton>

        {showEditTopic && (
          <>
            {isModeEdit ? (
              <LoadingButton
                variant="text"
                size="small"
                onClick={onSaveClick}
                disabled={saveDisabled}
                loading={saveLoading}
              >
                SAVE
              </LoadingButton>
            ) : (
              <IconButton onClick={onEditing}>
                <EditOctagonIcon size={20} color={theme.palette.text.primary} />
              </IconButton>
            )}
          </>
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
          <FormTopicInfo
            formSubmitRef={formSubmitRef}
            setSaveDisabled={setSaveDisabled}
            setSaveLoading={setSaveLoading}
          />
        </Stack>

        {/* ------------Channel info tab--------------- */}
        {!isModeEdit && (
          <Stack sx={{ marginTop: '50px!important' }}>
            <ChannelInfoTab currentChat={currentTopic} />
          </Stack>
        )}
      </Stack>
    </Stack>
  );
};

export default SidebarTopicInfo;
