import React, { useMemo } from 'react';
import ForwardTo from '@/components/message/ForwardTo';
import TextLine from '@/components/message/TextLine';
import UserMsgLayout from '@/components/message/UserMsgLayout';
import ReplyMsg from '@/components/message/ReplyMsg';
import DateLine from '@/components/message/DateLine';
import AttachmentMsg from '@/components/message/AttachmentMsg';
import LinkPreviewMsg from '@/components/message/LinkPreviewMsg';
import VoiceMsg from '@/components/message/VoiceMsg';

const RegularMsg = React.memo(({ message, isLastInGroup, onScrollToReplyMsg, isHighlighted }) => {
  const isEdited = message?.updated_at;

  const renderAttachments = useMemo(() => {
    if (!message?.attachments || message?.attachments.length === 0) return null;

    const attachments = message?.attachments.filter(attachment => ['video', 'image', 'file'].includes(attachment.type));
    const voiceData = message?.attachments.find(attachment => attachment.type === 'voiceRecording');
    const linkPreview =
      message?.attachments[0] && message?.attachments[0].type === 'linkPreview' && message?.attachments[0].title
        ? message?.attachments[0]
        : null;

    if (attachments && attachments.length > 0) {
      return <AttachmentMsg attachments={attachments} />;
    }
    if (linkPreview) {
      return <LinkPreviewMsg linkPreview={linkPreview} />;
    }
    if (voiceData) {
      return <VoiceMsg voiceData={voiceData} isMyMessage={message.isMyMessage} />;
    }

    return null;
  }, [message?.attachments]);

  const widthTextLine = useMemo(() => {
    if (!message?.attachments || message?.attachments.length === 0) {
      return '100%';
    }

    return '400px';
  }, [message?.attachments]);

  return (
    <UserMsgLayout message={message} isLastInGroup={isLastInGroup} isHighlighted={isHighlighted}>
      {message?.forward_cid && <ForwardTo type={message.type} isMyMessage={message.isMyMessage} />}

      {message?.quoted_message && <ReplyMsg message={message} onScrollToReplyMsg={onScrollToReplyMsg} />}

      {renderAttachments}

      {message.text && <TextLine text={message.text} isMyMessage={message.isMyMessage} widthTextLine={widthTextLine} />}

      <DateLine
        date={isEdited ? message.updated_at : message.created_at}
        isEdited={isEdited}
        isMyMessage={message.isMyMessage}
      />
    </UserMsgLayout>
  );
});

export default RegularMsg;
