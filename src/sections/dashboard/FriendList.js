import React, { useMemo } from 'react';
import { Stack, Typography, Box, useTheme } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import { ChatType, RoleMember } from '../../constants/commons-const';
import NoResult from '../../assets/Illustration/NoResult';
import ContactElement from '../../components/ContactElement';

const FriendList = ({
  searchQuery = '',
  noResultWidth = 150,
  noResultHeight = 150,
  noResultFontSize = '14px',
  avatarSize = 44,
  primaryFontSize = '14px',
  secondaryFontSize = '12px',
  showCheckbox = false,
  selectedUsers = [],
  onCheck = () => {},
}) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { activeChannels } = useSelector(state => state.channel);
  const { user_id } = useSelector(state => state.auth);

  const renderedFriends = useMemo(() => {
    const directChannels = activeChannels.filter(channel => {
      const isDirect = channel.type === ChatType.MESSAGING;
      const otherMember = Object.values(channel.state.members).find(member => member.user_id !== user_id);
      return isDirect && otherMember && otherMember.channel_role === RoleMember.OWNER;
    });

    const filteredChannels = directChannels.filter(channel => {
      const name = channel.data?.name || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Group by first letter of channel name (case-insensitive) cho Friends & Channels
    const grouped = filteredChannels.reduce((acc, channel) => {
      const name = channel.data?.name || '';
      const firstLetter = name.charAt(0).toUpperCase();
      if (!acc[firstLetter]) acc[firstLetter] = [];
      acc[firstLetter].push(channel);
      return acc;
    }, {});

    const sortedKeys = Object.keys(grouped).sort();

    if (sortedKeys.length > 0) {
      return (
        <>
          {sortedKeys.map(letter => (
            <div key={letter}>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  fontSize: '20px',
                  color: theme.palette.text.primary,
                  mb: 1,
                }}
              >
                {letter}
              </Typography>
              {grouped[letter].map(item => (
                <Box key={`channel-${item.id}`} sx={{ marginBottom: '5px' }}>
                  <ContactElement
                    channel={item}
                    avatarSize={avatarSize}
                    primaryFontSize={primaryFontSize}
                    secondaryFontSize={secondaryFontSize}
                    showCheckbox={showCheckbox}
                    selectedUsers={selectedUsers}
                    onCheck={onCheck}
                  />
                </Box>
              ))}
            </div>
          ))}
        </>
      );
    } else {
      return (
        <Stack key="no-channels" sx={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <NoResult width={noResultWidth} height={noResultHeight} />
          <Typography
            variant="subtitle2"
            sx={{
              textAlign: 'center',
              fontSize: noResultFontSize,
              color: theme.palette.text.primary,
              fontWeight: 600,
            }}
          >
            No result {searchQuery ? `for "${searchQuery}"` : ''}
          </Typography>
        </Stack>
      );
    }
  }, [
    activeChannels,
    user_id,
    theme,
    searchQuery,
    noResultWidth,
    noResultHeight,
    noResultFontSize,
    avatarSize,
    primaryFontSize,
    secondaryFontSize,
    showCheckbox,
    selectedUsers,
    onCheck,
  ]);

  return <>{renderedFriends}</>;
};

export default FriendList;
