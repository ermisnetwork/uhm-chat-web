import React, { useState } from 'react';
import { Box, Stack, Typography, Menu, IconButton } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import MemberAvatar from './MemberAvatar';
import { AvatarShape, RoleMember } from '../constants/commons-const';
import { CrownIcon } from './Icons';
import { X } from 'phosphor-react';
import CustomCheckbox from './CustomCheckbox';
import { useSelector } from 'react-redux';
import { myRoleInChannel } from '../utils/commons';

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

const MemberElement = ({
  member,
  avatarSize = 44,
  primaryFontSize = '14px',
  secondaryFontSize = '12px',
  onRemoveMember,
  onUnbanMember,
  onCheck = null,
  selectedMembers = [],
}) => {
  const theme = useTheme();
  const { user_id } = useSelector(state => state.auth);
  const { currentChannel } = useSelector(state => state.channel);
  const myRole = myRoleInChannel(currentChannel);
  const [anchorEl, setAnchorEl] = useState(null);

  const isVisibleCrown = [RoleMember.OWNER, RoleMember.MOD].includes(member.channel_role);
  const canShowRemove =
    onRemoveMember &&
    ((myRole === RoleMember.OWNER && member.channel_role !== RoleMember.OWNER) ||
      (myRole === RoleMember.MOD && ![RoleMember.OWNER, RoleMember.MOD].includes(member.channel_role)));

  const onRemove = data => {
    onRemoveMember(data);
  };

  const onUnban = data => {
    onUnbanMember(data);
  };

  const toggleMember = (member, selectedMembers = []) => {
    if (!member?.user_id) return selectedMembers;
    if (selectedMembers.some(m => m.user_id === member.user_id)) {
      return selectedMembers.filter(m => m.user_id !== member.user_id);
    }
    return [...selectedMembers, member];
  };

  const onChangeCheckbox = value => {
    const newSelected = toggleMember(member, selectedMembers);
    onCheck(member, newSelected);
  };

  const onClickMemberItem = () => {
    if (onCheck) {
      const newSelected = toggleMember(member, selectedMembers);
      onCheck(member, newSelected);
    } else {
      onSelect(member);
    }
  };

  const textRoleMember = channel_role => {
    switch (channel_role) {
      case RoleMember.OWNER:
        return 'Owner';
      case RoleMember.MOD:
        return 'Moderator';
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
    <StyledMemberItem onClick={onClickMemberItem}>
      <Stack direction="row" alignItems="center" gap={1} sx={{ width: '100%' }}>
        {onCheck && (
          <CustomCheckbox
            checked={selectedMembers.some(m => m.user_id === member.user_id)}
            onClick={e => e.stopPropagation()}
            onChange={onChangeCheckbox}
            sx={{ padding: 0 }}
          />
        )}

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
            {isVisibleCrown && <CrownIcon />}
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

        {canShowRemove && (
          <IconButton
            onClick={e => {
              e.stopPropagation();
              onRemove(member);
            }}
          >
            <X size={20} />
          </IconButton>
        )}

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
