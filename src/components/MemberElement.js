import React from 'react';
import { Box, Stack, Typography, Menu } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import MemberAvatar from './MemberAvatar';
import { AvatarShape, RoleMember } from '../constants/commons-const';
import { CrownIcon } from './Icons';

const StyledMemberItem = styled(Box)(({ theme }) => ({
  width: '100%',
  borderRadius: '16px',
  position: 'relative',
  transition: 'background-color 0.2s ease-in-out',
  display: 'flex',
  alignItems: 'center',
  padding: '5px',
  '&:hover': {
    cursor: 'pointer',
    backgroundColor: theme.palette.divider,
  },
}));

const StyledMenu = styled(props => (
  <Menu
    elevation={0}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'right',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'right',
    }}
    {...props}
  />
))(({ theme }) => ({
  '& .MuiPaper-root': {
    borderRadius: 6,
    marginTop: theme.spacing(1),
    minWidth: 180,
    boxShadow:
      'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
    '& .MuiMenu-list': {
      padding: '4px 0',
    },
  },
}));

const MemberElement = ({
  member,
  avatarSize = 44,
  primaryFontSize = '14px',
  secondaryFontSize = '12px',
  data,
  onRemoveMember,
  onUnbanMember,
  showMenu,
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const isOwner = member.channel_role === RoleMember.OWNER;

  const onOpenMenu = event => {
    setAnchorEl(event.currentTarget);
  };

  const onCloseMenu = () => {
    setAnchorEl(null);
  };

  const onRemove = data => {
    onRemoveMember(data);
    onCloseMenu();
  };

  const onUnban = data => {
    onUnbanMember(data);
    onCloseMenu();
  };

  const textRoleMember = channel_role => {
    switch (channel_role) {
      case RoleMember.OWNER:
        return 'Owner';
      case RoleMember.MOD:
        return 'Mod';
      case RoleMember.MEMBER:
        return 'Member';
      case RoleMember.PENDING:
        return 'Pending';
      default:
        return '';
    }
  };

  const getColorRole = channel_role => {
    switch (channel_role) {
      case RoleMember.OWNER:
        return theme.palette.primary.main;
      case RoleMember.MOD:
        return theme.palette.primary.main;
      case RoleMember.MEMBER:
        return theme.palette.text.secondary;
      case RoleMember.PENDING:
        return theme.palette.info.main;
      default:
        return theme.palette.text.primary;
    }
  };

  return (
    <StyledMemberItem>
      <Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%' }}>
        <MemberAvatar
          member={member.user}
          width={avatarSize}
          height={avatarSize}
          openLightbox={true}
          shape={AvatarShape.Round}
        />
        <Stack sx={{ minWidth: 'auto', flex: 1, overflow: 'hidden' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Typography
              variant="subtitle2"
              sx={{
                minWidth: 'auto',
                overflow: 'hidden',
                fontSize: primaryFontSize,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {member.user.name}
            </Typography>
            {isOwner && <CrownIcon />}
          </Stack>

          <Typography
            variant="caption"
            sx={{
              color: getColorRole(member.channel_role),
              fontSize: secondaryFontSize,
              fontWeight: 400,
            }}
          >
            {textRoleMember(member.channel_role)}
          </Typography>
        </Stack>

        {/* {showMenu && (
          <Stack direction={'row'} spacing={2} alignItems={'center'}>
            <IconButton onClick={onOpenMenu}>
              <DotsThreeVertical size={22} />
            </IconButton>

            <StyledMenu anchorEl={anchorEl} open={open} onClose={onCloseMenu}>
              {onRemoveMember && (
                <MenuItem onClick={() => onRemove(data)} sx={{ color: theme.palette.error.main }}>
                  <Trash size={18} style={{ marginRight: 10 }} />
                  Remove
                </MenuItem>
              )}

              {onUnbanMember && (
                <MenuItem onClick={() => onUnban(data)} sx={{ color: theme.palette.error.main }}>
                  <LockOpen size={18} style={{ marginRight: 10 }} />
                  Unban
                </MenuItem>
              )}
            </StyledMenu>
          </Stack>
        )} */}
      </Stack>
    </StyledMemberItem>
  );
};

export default MemberElement;
