import { CallType } from '../constants/commons-const';
import { LocalStorageKey } from '../constants/localStorage-const';

export function convertMessageSignal(input) {
  if (!input) return null;

  const myUserId = window.localStorage.getItem(LocalStorageKey.UserId);
  const parts = input.split(' ');
  const number = parseInt(parts[0]);
  const callerId = parts[1];
  const isMe = myUserId === callerId; // tôi là người gọi

  let enderId = '';
  let duration = '';
  let callType = '';
  let color = '';
  if (number === 3 || number === 6) {
    enderId = parts[2];
    duration = parts[3] === '0' ? '' : parts[3];
  }

  // Xác định text tương ứng với number
  let text;
  switch (number) {
    case 1: // AudioCallStarted
      text = ``;
      callType = CallType.AUDIO;
      color = '';
      break;
    case 2: // AudioCallMissed
      text = isMe ? 'messageSignal.outgoing_audio_call' : 'messageSignal.missed_audio_call';
      callType = CallType.AUDIO;
      color = '#FF4842';
      break;
    case 3: // AudioCallEnded
      if (duration) {
        text = isMe ? 'messageSignal.outgoing_audio_call' : 'messageSignal.incoming_audio_call';
        color = '#54D62C';
      } else {
        if (enderId === myUserId) {
          text = 'messageSignal.cancel_audio_call';
        } else {
          text = 'messageSignal.missed_audio_call';
        }
        color = '#FF4842';
      }
      callType = CallType.AUDIO;
      break;
    case 4: // VideoCallStarted
      text = ``;
      callType = CallType.VIDEO;
      color = '';
      break;
    case 5: // VideoCallMissed
      text = isMe ? 'messageSignal.outgoing_video_call' : 'messageSignal.missed_video_call';
      callType = CallType.VIDEO;
      color = '#FF4842';
      break;
    case 6: // VideoCallEnded
      if (duration) {
        text = isMe ? 'messageSignal.outgoing_video_call' : 'messageSignal.incoming_video_call';
        color = '#54D62C';
      } else {
        if (enderId === myUserId) {
          text = 'messageSignal.cancel_video_call';
        } else {
          text = 'messageSignal.missed_video_call';
        }
        color = '#FF4842';
      }
      callType = CallType.VIDEO;
      break;
    case 7: // AudioCallRejected
      text = isMe ? 'messageSignal.recipient_rejected_audio_call' : 'messageSignal.rejected_audio_call';
      callType = CallType.AUDIO;
      color = '#FF4842';
      break;
    case 8: // VideoCallCallRejected
      text = isMe ? 'messageSignal.recipient_rejected_video_call' : 'messageSignal.rejected_video_call';
      callType = CallType.VIDEO;
      color = '#FF4842';
      break;
    case 9: // AudioCallBusy
      text = isMe ? 'messageSignal.recipient_was_busy' : 'messageSignal.missed_audio_call';
      callType = CallType.AUDIO;
      color = '#FF4842';
      break;
    case 10: // VideoCallBusy
      text = isMe ? 'messageSignal.recipient_was_busy' : 'You missed video call';
      callType = CallType.VIDEO;
      color = '#FF4842';
      break;
    default:
      text = input;
      callType = '';
      color = '';
  }

  return { text, duration: formatDuration(duration), callType, color };
}

export const formatDuration = duration => {
  if (!duration) return '';

  const totalSeconds = Math.floor(duration / 1000); // Chuyển từ ms sang giây
  const minutes = Math.floor(totalSeconds / 60); // Số phút
  const seconds = totalSeconds % 60; // Số giây còn lại

  return `${minutes} min, ${seconds} sec`;
};
