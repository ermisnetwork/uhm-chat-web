import { useCallback, useRef } from 'react';

export const useMediaDecoder = (remoteVideoRef, nodeRef) => {
  const videoDecoderRef = useRef(null);
  const videoWriterRef = useRef(null);
  const audioDecoderRef = useRef(null);
  const isWaitingForKeyFrame = useRef(true);
  const audioContextRef = useRef(null);
  const mediaDestinationRef = useRef(null);
  const nextStartTimeRef = useRef(0);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });

      mediaDestinationRef.current = audioContextRef.current.createMediaStreamDestination();

      // Resume AudioContext nếu bị suspended (cần user interaction)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
  }, []);

  const playDecodedAudio = useCallback(async audioData => {
    try {
      const { numberOfChannels, numberOfFrames, sampleRate, format } = audioData;
      const audioContext = audioContextRef.current;
      if (!audioContext) return;

      // Tạo AudioBuffer
      const audioBuffer = audioContext.createBuffer(numberOfChannels, numberOfFrames, sampleRate);

      // ✅ Tạo buffer để copy dữ liệu
      const dataSize = numberOfFrames * numberOfChannels;
      const tempBuffer = new Float32Array(dataSize);

      // ✅ Copy dữ liệu từ AudioData với format f32-planar
      audioData.copyTo(tempBuffer, {
        planeIndex: 0,
        format: 'f32-planar',
      });

      // Copy dữ liệu vào từng kênh
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        const offset = ch * numberOfFrames; // offset cho từng kênh trong planar format

        for (let i = 0; i < numberOfFrames; i++) {
          channelData[i] = tempBuffer[offset + i];
        }
      }

      // Tạo nguồn phát âm thanh
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 1.0;
      source.connect(gainNode).connect(mediaDestinationRef.current);

      // Đảm bảo phát liên tục
      if (nextStartTimeRef.current < audioContext.currentTime) {
        nextStartTimeRef.current = audioContext.currentTime;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += numberOfFrames / sampleRate;

      // Giải phóng bộ nhớ
      if (audioData && typeof audioData.close === 'function') {
        audioData.close();
      }
    } catch (err) {
      console.error('Error in playDecodedAudio:', err);
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

    // Gán cho remoteVideoRef
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = combinedStream;
      remoteVideoRef.current.muted = false;
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
    const audioDecoder = new AudioDecoder({
      output: async audioData => {
        playDecodedAudio(audioData);
      },
      error: err => {
        console.error('AudioDecoder error:', err);
      },
    });

    audioDecoderRef.current = audioDecoder;
  }, [remoteVideoRef]);

  const mediaDecoder = useCallback(async () => {
    initDecoders();

    while (true) {
      try {
        const data = await nodeRef.current.asyncRecv();

        // ✅ Chuyển Uint8Array thành ArrayBuffer
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        if (buffer.byteLength < 5) {
          console.warn('⚠️ Invalid packet: too small', buffer.byteLength);
          continue;
        }

        const view = new DataView(buffer);

        // Byte 0 = Type, Byte 1-4 = Timestamp
        const frameType = view.getUint8(0); // Byte 0: Type code
        const timestamp = view.getUint32(1, false); // Byte 1-4: Timestamp

        let payload;
        if (frameType === 0) {
          payload = buffer.slice(1); // Config chỉ có payload, không có timestamp
        } else {
          payload = buffer.slice(5); // Byte 5+: Data
        }

        // 📋 Config message (type=0)
        if (frameType === 0) {
          try {
            const decoder = new TextDecoder();
            const jsonString = decoder.decode(payload);
            const configMsg = JSON.parse(jsonString);

            console.log('📋 Received DecoderConfigs:', configMsg);
            const { videoConfig, audioConfig } = configMsg;

            if (videoConfig) {
              isWaitingForKeyFrame.current = true;
              const videoDescriptionBytes = Uint8Array.from(atob(videoConfig.description), c => c.charCodeAt(0)).buffer;

              videoDecoderRef.current.configure({
                codec: videoConfig.codec,
                codedWidth: videoConfig.codedWidth,
                codedHeight: videoConfig.codedHeight,
                description: videoDescriptionBytes,
              });
            }
            if (audioConfig) {
              const audioDescriptionBytes = Uint8Array.from(atob(audioConfig.description), c => c.charCodeAt(0)).buffer;

              audioDecoderRef.current.configure({
                codec: audioConfig.codec,
                sampleRate: audioConfig.sampleRate,
                numberOfChannels: audioConfig.numberOfChannels,
                // description: audioDescriptionBytes,
              });
            }
          } catch (e) {
            console.error('❌ Config parse error:', e);
          }
          continue;
        }

        // 🎥 Video frames (key=1, delta=2)
        if (frameType === 1 || frameType === 2) {
          if (!videoDecoderRef.current || videoDecoderRef.current.state !== 'configured') {
            console.warn('⚠️ VideoDecoder not ready, state:', videoDecoderRef.current?.state);
            continue;
          }

          const isKeyFrame = frameType === 1;

          // ✅ Chỉ decode khi đã có key frame hoặc frame hiện tại là key frame
          if (isWaitingForKeyFrame.current) {
            if (!isKeyFrame) {
              console.log('🔄 Skipping delta frame, still waiting for key frame');
              continue; // Skip this iteration instead of return
            }
            console.log('🎯 First key frame received after configure');
          }

          try {
            const chunk = new EncodedVideoChunk({
              type: isKeyFrame ? 'key' : 'delta',
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
        } else if (frameType === 3) {
          // 🔊 Audio frames (audio=3)

          if (!audioDecoderRef.current || audioDecoderRef.current.state !== 'configured') {
            console.warn('⚠️ AudioDecoder not ready, state:', audioDecoderRef.current?.state);
            continue;
          }

          try {
            const chunk = new EncodedAudioChunk({
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
      } catch (error) {}
    }
  }, []);

  return { mediaDecoder };
};
