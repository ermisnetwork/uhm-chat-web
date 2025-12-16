import React from 'react';
import ForwardTo from './ForwardTo';
import TextLine from './TextLine';
import UserMsgLayout from './UserMsgLayout';
import ReplyMsg from './ReplyMsg';
import DateLine from './DateLine';
import AttachmentMsg from './AttachmentMsg';
import LinkPreviewMsg from './LinkPreviewMsg';

const RegularMsg = React.memo(({ message, isLastInGroup, onScrollToReplyMsg, isHighlighted }) => {
  const isEdited = message?.updated_at;

  const renderAttachments = () => {
    if (
      message.attachments.some(attachment => ['video', 'image', 'file', 'voiceRecording'].includes(attachment.type))
    ) {
      return <AttachmentMsg message={message} />;
    } else {
      const linkPreview = message.attachments[0]; // chỉ hiển thị linkPreview đầu tiên
      const isLinkPreview = linkPreview?.title;

      if (isLinkPreview) {
        return <LinkPreviewMsg message={message} />;
      }
    }
  };

  return (
    <UserMsgLayout message={message} isLastInGroup={isLastInGroup} isHighlighted={isHighlighted}>
      {message?.forward_cid && <ForwardTo type={message.type} isMyMessage={message.isMyMessage} />}

      {message?.quoted_message && <ReplyMsg message={message} onScrollToReplyMsg={onScrollToReplyMsg} />}

      {message.attachments && message.attachments.length > 0 && renderAttachments()}

      {message.text && <TextLine text={message.text} isMyMessage={message.isMyMessage} />}

      <DateLine
        date={isEdited ? message.updated_at : message.created_at}
        isEdited={isEdited}
        isMyMessage={message.isMyMessage}
      />
    </UserMsgLayout>
  );
});

export default RegularMsg;
