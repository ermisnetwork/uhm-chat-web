import React from 'react';
import DateLine from '@/components/message/DateLine';
import PollBox from '@/components/message/PollBox';
import UserMsgLayout from '@/components/message/UserMsgLayout';

const PollMsg = React.memo(({ message, isLastInGroup }) => {
  const isEdited = message.updated_at;
  return (
    <UserMsgLayout message={message} isLastInGroup={isLastInGroup}>
      <PollBox message={message} />

      <DateLine
        date={isEdited ? message.updated_at : message.created_at}
        isEdited={isEdited}
        isMyMessage={message.isMyMessage}
      />
    </UserMsgLayout>
  );
});

export default PollMsg;
