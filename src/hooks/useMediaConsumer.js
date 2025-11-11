import { useCallback, useEffect, useRef } from 'react';
import { useLibAV } from './useLibAV';

export const useMediaConsumer = (channelId, videoRef) => {
  const { LibAVWebCodecs } = useLibAV();
  const videoDecoderRef = useRef(null);
  const videoWriterRef = useRef(null);
  const audioDecoderRef = useRef(null);
  const combinedStreamRef = useRef(null);
  const isWaitingForKeyFrame = useRef(true);
  const audioContextRef = useRef(null);
  const mediaDestinationRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const firstPacketRef = useRef(true);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });

      mediaDestinationRef.current = audioContextRef.current.createMediaStreamDestination();

      // Resume AudioContext nếu bị suspended (cần user interaction)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      nextStartTimeRef.current = audioContextRef.current.currentTime;
      // firstPacketRef.current = true;
    }
  }, []);

  const playDecodedAudio = useCallback(async audioData => {
    try {
      // Lấy thông tin cơ bản từ audioData
      const { numberOfChannels, numberOfFrames, sampleRate, _data } = audioData;
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      // Nếu là packet đầu tiên thì bỏ qua 80 frame đầu (tránh tiếng pop/noise)
      // const PRE_SKIP = firstPacketRef.current ? 80 : 0;
      // firstPacketRef.current = false;

      // Tính số frame thực sự sẽ phát (đã bỏ qua PRE_SKIP)
      // const framesToPlay = numberOfFrames - PRE_SKIP;
      const framesToPlay = numberOfFrames;
      // Tạo AudioBuffer với số kênh, số frame và sample rate tương ứng
      const audioBuffer = audioContext.createBuffer(numberOfChannels, framesToPlay, sampleRate);

      // Chuyển dữ liệu từ dạng interleaved (xen kẽ các kênh) sang planar (mỗi kênh 1 mảng riêng)
      // Ví dụ: [L0, R0, L1, R1, ...] -> kênh 0: [L0, L1, ...], kênh 1: [R0, R1, ...]
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        // for (let i = PRE_SKIP; i < numberOfFrames; i++) {
        //   channelData[i - PRE_SKIP] = _data[i * numberOfChannels + ch];
        // }

        for (let i = 0; i < numberOfFrames; i++) {
          channelData[i] = _data[i * numberOfChannels + ch];
        }
      }

      // Tạo nguồn phát âm thanh từ AudioBuffer
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Tạo gainNode để điều chỉnh âm lượng (ở đây để mặc định 1.0)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      // Kết nối nguồn phát qua gainNode tới MediaStreamDestination (để phát ra loa hoặc stream)
      source.connect(gainNode).connect(mediaDestinationRef.current);

      // Đảm bảo các đoạn âm thanh phát nối tiếp nhau, không bị chồng tiếng
      if (nextStartTimeRef.current < audioContext.currentTime) nextStartTimeRef.current = audioContext.currentTime;

      // Phát đoạn âm thanh tại thời điểm đã tính toán
      source.start(nextStartTimeRef.current);
      // Cập nhật thời điểm phát cho đoạn tiếp theo
      nextStartTimeRef.current += framesToPlay / sampleRate;

      // Giải phóng bộ nhớ cho audioData nếu có
      if (audioData && typeof audioData.close === 'function') {
        audioData.close();
      }
    } catch (err) {
      console.error('Error in playDecodedAudio:', err);
      // Đảm bảo luôn giải phóng audioData kể cả khi lỗi
      if (audioData && typeof audioData.close === 'function') {
        audioData.close();
      }
    }
  }, []);

  const initDecoders = useCallback(() => {
    // Đóng decoders cũ trước
    if (videoDecoderRef.current && videoDecoderRef.current.state !== 'closed') {
      videoDecoderRef.current.close();
    }
    if (audioDecoderRef.current && audioDecoderRef.current.state !== 'closed') {
      audioDecoderRef.current.close();
    }

    // Tạo video track
    const videoTrackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    videoWriterRef.current = videoTrackGenerator.writable.getWriter();

    // Tạo AudioContext + MediaStreamDestination
    initAudioContext();

    // Lấy audio track từ AudioContext
    const audioTrack = mediaDestinationRef.current.stream.getAudioTracks()[0];

    const combinedStream = new MediaStream([videoTrackGenerator, audioTrack]);
    combinedStreamRef.current = combinedStream;

    // Gán cho videoRef
    if (videoRef.current) {
      videoRef.current.srcObject = combinedStream;
      videoRef.current.muted = false;
    }

    isWaitingForKeyFrame.current = true;

    // Init video decoder
    const videoDecoder = new VideoDecoder({
      output: async frame => {
        try {
          await videoWriterRef.current.write(frame);
        } catch (err) {
          frame.close();
        }
      },
      error: err => {
        console.error('VideoDecoder error:', err);
        isWaitingForKeyFrame.current = true;
      },
    });

    videoDecoderRef.current = videoDecoder;

    // Init audio decoder
    const audioDecoder = new LibAVWebCodecs.AudioDecoder({
      output: async audioData => {
        // console.log('--audioData--', audioData);
        playDecodedAudio(audioData);
      },
      error: err => {
        console.error('AudioDecoder error:', err);
      },
    });
    audioDecoderRef.current = audioDecoder;
  }, [videoRef]);

  const connectConsumer = useCallback(() => {
    const ws = new WebSocket(`wss://4044.bandia.vn/consume/${channelId}`);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      console.log('✅ Connected to consumer WebSocket');
      initDecoders();
    };

    ws.onmessage = event => {
      // 🧠 1️⃣ Nếu là JSON string → xử lý cấu hình Decoder
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'DecoderConfigs') {
            if (msg.videoConfig) {
              isWaitingForKeyFrame.current = true;

              console.log('🎥 Received Video DecoderConfigs:', msg.videoConfig);
              const videoDescriptionBytes = Uint8Array.from(atob(msg.videoConfig.description), c =>
                c.charCodeAt(0),
              ).buffer;

              videoDecoderRef.current.configure({
                codec: msg.videoConfig.codec,
                codedWidth: msg.videoConfig.codedWidth,
                codedHeight: msg.videoConfig.codedHeight,
                description: videoDescriptionBytes,
              });
            }

            if (msg.audioConfig) {
              console.log('🔊 Received Audio DecoderConfigs:', msg.audioConfig);
              const audioDescriptionBytes = Uint8Array.from(atob(msg.audioConfig.description), c =>
                c.charCodeAt(0),
              ).buffer;

              audioDecoderRef.current.configure({
                codec: msg.audioConfig.codec,
                sampleRate: msg.audioConfig.sampleRate,
                numberOfChannels: msg.audioConfig.numberOfChannels,
                // description: audioDescriptionBytes,
              });
            }
          }
        } catch (err) {
          console.warn('⚠️ Invalid JSON message:', err);
        }
        return;
      }

      // 🧠 2️⃣ Nếu là binary → xử lý gói video
      if (event.data instanceof ArrayBuffer) {
        const buffer = event.data;
        if (buffer.byteLength < 5) {
          console.warn('⚠️ Invalid packet: too small', buffer.byteLength);
          return;
        }

        const view = new DataView(buffer);
        const timestamp = view.getUint32(0, false);
        const frameType = view.getUint8(4);

        const payload = buffer.slice(5);

        // 🎥 Video frames (key=0, delta=1)
        if (frameType === 0 || frameType === 1) {
          if (!videoDecoderRef.current || videoDecoderRef.current.state !== 'configured') {
            console.warn('⚠️ VideoDecoder not ready, state:', videoDecoderRef.current?.state);
            return;
          }

          const isKeyFrame = frameType === 0;

          // ✅ Chỉ decode khi đã có key frame hoặc frame hiện tại là key frame
          if (isWaitingForKeyFrame.current) {
            if (!isKeyFrame) {
              console.log('🔄 Skipping delta frame, still waiting for key frame');
              return;
            }
            console.log('🎯 First key frame received after configure');
          }

          try {
            const chunk = new EncodedVideoChunk({
              type: frameType === 0 ? 'key' : 'delta',
              timestamp: timestamp * 1000,
              data: payload,
            });

            videoDecoderRef.current.decode(chunk);

            // ✅ Nếu decode key frame thành công, cho phép decode delta frames
            if (isKeyFrame) {
              isWaitingForKeyFrame.current = false;
              console.log('✅ Key frame decoded successfully, now accepting delta frames');
            }
          } catch (e) {
            console.error('❌ Video decode error:', e);

            if (e.name === 'InvalidStateError' || e.name === 'DataError') {
              if (videoDecoderRef.current && videoDecoderRef.current.state !== 'closed') {
                videoDecoderRef.current.close();
              }
              videoDecoderRef.current = null;
              isWaitingForKeyFrame.current = true;
            }
          }
        }
        // 🔊 Audio frames (audio=2)
        else if (frameType === 2) {
          if (!audioDecoderRef.current || audioDecoderRef.current.state !== 'configured') {
            console.warn('⚠️ AudioDecoder not ready, state:', audioDecoderRef.current?.state);
            return;
          }
          try {
            const chunk = new LibAVWebCodecs.EncodedAudioChunk({
              type: 'key',
              timestamp: timestamp * 1000,
              data: payload,
            });
            audioDecoderRef.current.decode(chunk);
          } catch (e) {
            console.error('❌ Audio decode error:', e);

            if (e.name === 'InvalidStateError' || e.name === 'DataError') {
              console.log('🔄 Reinitializing audio decoder due to error...');

              // Đóng decoder hiện tại
              if (audioDecoderRef.current && audioDecoderRef.current.state !== 'closed') {
                audioDecoderRef.current.close();
              }
              audioDecoderRef.current = null;
            }
          }
        } else {
          console.warn('⚠️ Unknown frame type:', frameType);
        }
      } else {
        console.warn('⚠️ Unknown message type:', typeof event.data);
      }
    };

    ws.onerror = err => console.error('❌ WS Error:', err);
    ws.onclose = () => {
      console.log('🔌 WebSocket closed');
      if (videoDecoderRef.current && videoDecoderRef.current.state !== 'closed') {
        videoDecoderRef.current.close();
      }
      if (videoWriterRef.current) {
        videoWriterRef.current.close();
      }
    };
  }, [channelId, initDecoders]);

  return { connectConsumer };
};
