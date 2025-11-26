import { useCallback, useRef } from 'react';
import { nodeCall } from '../nodeCall';

export const useMediaDecoderSync = remoteVideoRef => {
  const videoDecoderRef = useRef(null);
  const videoWriterRef = useRef(null);
  const audioDecoderRef = useRef(null);
  const isWaitingForKeyFrame = useRef(true);
  const audioContextRef = useRef(null);
  const mediaDestinationRef = useRef(null);
  const nextStartTimeRef = useRef(0);

  // Lưu cấu hình Video gần nhất để khôi phục khi Decoder bị crash
  const lastVideoConfigRef = useRef(null);

  // Cấu hình độ trễ chấp nhận được (giây)
  const MAX_AUDIO_LATENCY = 0.1; // 100ms
  const MIN_BUFFER_AHEAD = 0.02; // 20ms

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
        latencyHint: 'interactive',
      });

      mediaDestinationRef.current = audioContextRef.current.createMediaStreamDestination();

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      nextStartTimeRef.current = audioContextRef.current.currentTime + MIN_BUFFER_AHEAD;
    }
  }, []);

  const playDecodedAudio = useCallback(async audioData => {
    try {
      const audioContext = audioContextRef.current;
      if (!audioContext) {
        audioData.close();
        return;
      }

      const { numberOfChannels, numberOfFrames, sampleRate } = audioData;
      const duration = numberOfFrames / sampleRate;
      const currentTime = audioContext.currentTime;

      // --- XỬ LÝ LATENCY & SYNC ---
      if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + MIN_BUFFER_AHEAD;
      } else if (nextStartTimeRef.current > currentTime + MAX_AUDIO_LATENCY) {
        // console.log('⚡ Audio latency too high, resetting sync...');
        nextStartTimeRef.current = currentTime + MIN_BUFFER_AHEAD;
      }

      const audioBuffer = audioContext.createBuffer(numberOfChannels, numberOfFrames, sampleRate);
      const size = numberOfChannels * numberOfFrames;
      const tempBuffer = new Float32Array(size);

      audioData.copyTo(tempBuffer, { planeIndex: 0, format: 'f32-planar' });

      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = tempBuffer.subarray(ch * numberOfFrames, (ch + 1) * numberOfFrames);
        audioBuffer.copyToChannel(channelData, ch);
      }

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(mediaDestinationRef.current);

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += duration;

      audioData.close();
    } catch (err) {
      console.error('Error in playDecodedAudio:', err);
      if (audioData && typeof audioData.close === 'function') {
        audioData.close();
      }
    }
  }, []);

  // Hàm riêng để tạo VideoDecoder, giúp dễ dàng gọi lại khi cần reset
  const setupVideoDecoder = useCallback(() => {
    if (videoDecoderRef.current) {
      try {
        if (videoDecoderRef.current.state !== 'closed') videoDecoderRef.current.close();
      } catch (e) {}
    }

    const videoDecoder = new VideoDecoder({
      output: async frame => {
        try {
          // Backpressure logic
          if (videoWriterRef.current && videoWriterRef.current.desiredSize <= 0) {
            frame.close();
            return;
          }
          if (videoWriterRef.current) {
            await videoWriterRef.current.write(frame);
          } else {
            frame.close();
          }
        } catch (err) {
          frame.close();
          console.error('Frame write error:', err);
        }
      },
      error: err => {
        console.error('❌ VideoDecoder CRASHED:', err);
        isWaitingForKeyFrame.current = true;

        // --- CƠ CHẾ TỰ PHỤC HỒI (SELF-HEALING) ---
        console.log('♻️ Attempting to respawn VideoDecoder...');

        // 1. Tạo lại decoder mới ngay lập tức
        setupVideoDecoder();

        // 2. Nếu đã từng có config, nạp lại ngay để sẵn sàng nhận frame tiếp theo
        if (lastVideoConfigRef.current && videoDecoderRef.current) {
          try {
            console.log('♻️ Re-applying last known video config...');
            videoDecoderRef.current.configure(lastVideoConfigRef.current);
          } catch (configErr) {
            console.error('Failed to re-configure after crash:', configErr);
          }
        }
      },
    });

    videoDecoderRef.current = videoDecoder;
  }, []);

  const initDecoders = useCallback(() => {
    // Audio Decoder Setup
    if (audioDecoderRef.current) audioDecoderRef.current.close();

    // Video Stream Setup
    const videoTrackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    videoWriterRef.current = videoTrackGenerator.writable.getWriter();

    initAudioContext();
    const audioTrack = mediaDestinationRef.current.stream.getAudioTracks()[0];
    const combinedStream = new MediaStream([videoTrackGenerator, audioTrack]);

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = combinedStream;
      remoteVideoRef.current.muted = false;
    }

    isWaitingForKeyFrame.current = true;

    // Gọi hàm setup Video Decoder tách biệt
    setupVideoDecoder();

    // Audio Decoder Setup
    audioDecoderRef.current = new AudioDecoder({
      output: audioData => playDecodedAudio(audioData),
      error: err => console.error('AudioDecoder error:', err),
    });
  }, [remoteVideoRef, initAudioContext, playDecodedAudio, setupVideoDecoder]);

  const mediaDecoder = useCallback(async () => {
    initDecoders();

    while (true) {
      try {
        if (!nodeCall) break;
        const data = await nodeCall.asyncRecv();

        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        if (buffer.byteLength < 5) continue;
        const view = new DataView(buffer);
        const frameType = view.getUint8(0);
        const timestamp = view.getUint32(1, false);
        let payload = frameType === 0 ? buffer.slice(1) : buffer.slice(5);

        // HANDLE CONFIG
        if (frameType === 0) {
          try {
            const decoder = new TextDecoder();
            const configMsg = JSON.parse(decoder.decode(payload));

            if (configMsg.videoConfig) {
              isWaitingForKeyFrame.current = true;
              const desc = Uint8Array.from(atob(configMsg.videoConfig.description), c => c.charCodeAt(0)).buffer;

              // Lưu config lại để dùng cho việc phục hồi sau lỗi
              const videoConfig = { ...configMsg.videoConfig, description: desc };
              lastVideoConfigRef.current = videoConfig;

              if (videoDecoderRef.current && videoDecoderRef.current.state !== 'closed') {
                videoDecoderRef.current.configure(videoConfig);
              }
            }
            if (configMsg.audioConfig) {
              if (audioDecoderRef.current && audioDecoderRef.current.state !== 'closed') {
                const audioConfig = configMsg.audioConfig;
                audioDecoderRef.current.configure({
                  codec: audioConfig.codec,
                  sampleRate: audioConfig.sampleRate,
                  numberOfChannels: audioConfig.numberOfChannels,
                });
              }
            }
          } catch (e) {
            console.error('Config Error', e);
          }
          continue;
        }

        // HANDLE VIDEO
        if (frameType === 1 || frameType === 2) {
          // Kiểm tra kỹ trạng thái decoder trước khi gọi decode
          if (videoDecoderRef.current && videoDecoderRef.current.state === 'configured') {
            const isKeyFrame = frameType === 1;

            if (isWaitingForKeyFrame.current) {
              if (!isKeyFrame) continue; // Skip delta
              console.log('✅ Resumed decoding at KeyFrame');
              isWaitingForKeyFrame.current = false;
            }

            // Drop frame logic if decoder is overwhelmed
            if (videoDecoderRef.current.decodeQueueSize > 10 && !isKeyFrame) {
              continue;
            }

            try {
              videoDecoderRef.current.decode(
                new EncodedVideoChunk({
                  type: isKeyFrame ? 'key' : 'delta',
                  timestamp: timestamp * 1000,
                  data: payload,
                }),
              );
            } catch (decodeErr) {
              // Bắt lỗi decode đồng bộ (Synchronous errors)
              console.error('Decode call failed:', decodeErr);
              // Nếu lỗi State, buộc reset
              if (videoDecoderRef.current.state === 'closed') {
                // Trigger logic phục hồi (thường error callback sẽ chạy trước, nhưng phòng hờ)
                setupVideoDecoder();
                if (lastVideoConfigRef.current) videoDecoderRef.current.configure(lastVideoConfigRef.current);
                isWaitingForKeyFrame.current = true;
              }
            }
          }
        }
        // HANDLE AUDIO
        else if (frameType === 3) {
          if (audioDecoderRef.current && audioDecoderRef.current.state === 'configured') {
            try {
              audioDecoderRef.current.decode(
                new EncodedAudioChunk({
                  type: 'key',
                  timestamp: timestamp * 1000,
                  data: payload,
                }),
              );
            } catch (e) {
              console.error('Audio decode err', e);
            }
          }
        }
      } catch (error) {
        console.error('Stream loop error', error);
        break;
      }
    }
  }, [initDecoders, playDecodedAudio, setupVideoDecoder]);

  const resetDecoders = useCallback(() => {
    // Đóng VideoDecoder
    if (videoDecoderRef.current) {
      try {
        videoDecoderRef.current.close?.();
      } catch (e) {
        console.warn('Error closing video decoder:', e);
      }
      videoDecoderRef.current = null;
    }

    // Đóng AudioDecoder
    if (audioDecoderRef.current) {
      try {
        audioDecoderRef.current.close?.();
      } catch (e) {
        console.warn('Error closing audio decoder:', e);
      }
      audioDecoderRef.current = null;
    }

    // Đóng AudioContext
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close?.();
      } catch (e) {
        console.warn('Error closing audio context:', e);
      }
      audioContextRef.current = null;
    }

    // Reset các ref khác
    videoWriterRef.current = null;
    isWaitingForKeyFrame.current = true;
    mediaDestinationRef.current = null;
    nextStartTimeRef.current = 0;
    lastVideoConfigRef.current = null;

    // Xóa srcObject của video nếu cần
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
  }, [remoteVideoRef]);

  return { mediaDecoder, resetDecoders };
};
