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
  const lastVideoConfigRef = useRef(null);
  const canReceiveDataRef = useRef(false);

  // Cấu hình độ trễ chấp nhận được (giây)
  const MAX_AUDIO_LATENCY = 0.1; // 100ms
  const MIN_BUFFER_AHEAD = 0.02; // 20ms

  const setCanReceiveData = useCallback(canReceive => {
    canReceiveDataRef.current = canReceive;
  }, []);

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
      if (!canReceiveDataRef.current) {
        audioData.close();
        return;
      }

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
        // nextStartTimeRef.current = currentTime + MIN_BUFFER_AHEAD;
        nextStartTimeRef.current = currentTime;
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
          if (!canReceiveDataRef.current) {
            frame.close();
            return;
          }

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
    // const videoTrackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
    // videoWriterRef.current = videoTrackGenerator.writable.getWriter();

    initAudioContext();
    const audioTrack = mediaDestinationRef.current.stream.getAudioTracks()[0];
    // const combinedStream = new MediaStream([videoTrackGenerator, audioTrack]);

    if (remoteVideoRef.current) {
      const audioOnlyStream = new MediaStream([audioTrack]);
      remoteVideoRef.current.srcObject = audioOnlyStream;
      remoteVideoRef.current.muted = false;
      // remoteVideoRef.current.srcObject = combinedStream;
      // remoteVideoRef.current.muted = false;
    }

    isWaitingForKeyFrame.current = true;

    // Audio Decoder Setup
    audioDecoderRef.current = new AudioDecoder({
      output: audioData => playDecodedAudio(audioData),
      error: err => console.error('AudioDecoder error:', err),
    });
  }, [remoteVideoRef, initAudioContext, playDecodedAudio]);

  function replaceNumbers(input) {
    const map = {
      2048: 123,
      4096: 153,
      8192: 156,
      16384: 183,
      32768: 186,
    };

    return input.replace(/2048|4096|8192|16384|32768/g, match => map[match]);
  }

  // Loop xử lý Audio & Config (Normal Recv)
  const runAudioConfigLoop = useCallback(async () => {
    while (true) {
      if (!nodeCall) break;
      try {
        const data = await nodeCall.asyncRecv();
        if (!canReceiveDataRef.current) {
          continue;
        }
        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

        // Config packets có 1 byte header, data packets có 5 bytes
        if (buffer.byteLength < 1) continue;

        const view = new DataView(buffer);
        const frameType = view.getUint8(0);

        // Type mapping: videoConfig=0, audioConfig=1, video-key=2, video-delta=3, audio=4

        // Handle VideoConfig (frameType = 0)
        if (frameType === 0) {
          const payload = buffer.slice(1); // Chỉ có 1 byte header
          const decoder = new TextDecoder();
          const videoConfig = JSON.parse(decoder.decode(payload));

          console.log('--videoConfig--', videoConfig);

          // Tạo video track nếu chưa có
          if (!videoWriterRef.current) {
            const videoTrackGenerator = new MediaStreamTrackGenerator({ kind: 'video' });
            videoWriterRef.current = videoTrackGenerator.writable.getWriter();

            const audioTrack = mediaDestinationRef.current.stream.getAudioTracks()[0];
            const combinedStream = new MediaStream([videoTrackGenerator, audioTrack]);

            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = combinedStream;
            }
          }

          // Tạo video decoder nếu chưa có
          if (!videoDecoderRef.current) {
            setupVideoDecoder();
          }

          isWaitingForKeyFrame.current = true;
          const desc = Uint8Array.from(atob(videoConfig.description), c => c.charCodeAt(0)).buffer;
          const codec = replaceNumbers(videoConfig.codec);

          const decoderConfig = {
            codec: codec,
            codedWidth: videoConfig.codedWidth,
            codedHeight: videoConfig.codedHeight,
            description: desc,
          };

          lastVideoConfigRef.current = decoderConfig;

          if (videoDecoderRef.current && videoDecoderRef.current.state !== 'closed') {
            videoDecoderRef.current.configure(decoderConfig);
          }
        }
        // Handle AudioConfig (frameType = 1)
        else if (frameType === 1) {
          const payload = buffer.slice(1); // Chỉ có 1 byte header
          const decoder = new TextDecoder();
          const audioConfig = JSON.parse(decoder.decode(payload));

          console.log('--audioConfig--', audioConfig);

          if (audioDecoderRef.current && audioDecoderRef.current.state !== 'closed') {
            audioDecoderRef.current.configure({
              codec: audioConfig.codec,
              sampleRate: audioConfig.sampleRate,
              numberOfChannels: audioConfig.numberOfChannels,
            });
          }
        }
        // Handle Audio Data (frameType = 4)
        else if (frameType === 4) {
          if (buffer.byteLength < 5) continue;
          const timestamp = view.getUint32(1, false);
          const payload = buffer.slice(5);

          if (audioDecoderRef.current && audioDecoderRef.current.state === 'configured') {
            audioDecoderRef.current.decode(
              new EncodedAudioChunk({
                type: 'key',
                timestamp: timestamp * 1000,
                data: payload,
              }),
            );
          }
        }
      } catch (e) {
        console.error('Audio/Config Loop Error', e);
        break;
      }
    }
  }, [setupVideoDecoder, remoteVideoRef]);

  // Loop xử lý Video (RaptorQ)
  const runVideoLoop = useCallback(async () => {
    while (true) {
      if (!nodeCall) break;
      try {
        const data = await nodeCall.asyncRecvRaptorQ();

        if (!canReceiveDataRef.current) {
          continue;
        }

        const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        if (buffer.byteLength < 5) continue;

        const view = new DataView(buffer);
        const frameType = view.getUint8(0);
        const timestamp = view.getUint32(1, false);
        const payload = buffer.slice(5);

        // Handle Video Data (frameType = 2: key, frameType = 3: delta)
        if (frameType === 2 || frameType === 3) {
          if (!videoDecoderRef.current) {
            // Audio-only call, skip video frames
            continue;
          }

          if (videoDecoderRef.current && videoDecoderRef.current.state === 'configured') {
            const isKeyFrame = frameType === 2;

            if (isWaitingForKeyFrame.current && !isKeyFrame) continue;
            if (isWaitingForKeyFrame.current) {
              console.log('✅ Resumed decoding at KeyFrame');
              isWaitingForKeyFrame.current = false;
            }

            if (videoDecoderRef.current.decodeQueueSize > 15 && !isKeyFrame) continue;

            try {
              videoDecoderRef.current.decode(
                new EncodedVideoChunk({
                  type: isKeyFrame ? 'key' : 'delta',
                  timestamp: timestamp * 1000,
                  data: payload,
                }),
              );
            } catch (decodeErr) {
              console.error('Decode call failed:', decodeErr);
              if (videoDecoderRef.current.state === 'closed') {
                setupVideoDecoder();
                if (lastVideoConfigRef.current) {
                  videoDecoderRef.current.configure(lastVideoConfigRef.current);
                }
                isWaitingForKeyFrame.current = true;
              }
            }
          }
        }
      } catch (e) {
        console.error('Video Loop Error', e);
        break;
      }
    }
  }, [setupVideoDecoder]);

  const mediaDecoder = useCallback(async () => {
    initDecoders();

    // Chạy song song 2 luồng độc lập, không đợi lẫn nhau
    // Dùng Promise.all để giữ hàm mediaDecoder không bị kết thúc
    try {
      await Promise.all([runVideoLoop(), runAudioConfigLoop()]);
    } catch (e) {
      console.error('Media loops stopped:', e);
    }
  }, [initDecoders, runVideoLoop, runAudioConfigLoop]);

  // const mediaDecoder = useCallback(async () => {
  //   initDecoders();

  //   // Hàm tiện ích để lắng nghe gói tin từ cả hai nguồn
  //   const getNextPacket = async () => {
  //     // Tạo Promise để lắng nghe Audio/Config
  //     const recvPromise = nodeCall.asyncRecv().then(data => ({ data }));

  //     // Tạo Promise để lắng nghe Video
  //     const recvRaptorQPromise = nodeCall.asyncRecvRaptorQ().then(data => ({ data }));

  //     // Chờ gói tin nào đến trước (race)
  //     return Promise.race([recvPromise, recvRaptorQPromise]);
  //   };

  //   while (true) {
  //     try {
  //       if (!nodeCall) break;

  //       // --- 1. Nhận gói tin từ luồng đến trước ---
  //       const receivedPacket = await getNextPacket();
  //       const data = receivedPacket.data;

  //       // const data = await nodeCall.asyncRecv();

  //       const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

  //       console.log('---buffer.byteLength--', buffer.byteLength);

  //       if (buffer.byteLength < 5) continue;
  //       const view = new DataView(buffer);
  //       const frameType = view.getUint8(0);
  //       const timestamp = view.getUint32(1, false);
  //       let payload = frameType === 0 ? buffer.slice(1) : buffer.slice(5);

  //       // HANDLE CONFIG
  //       if (frameType === 0) {
  //         try {
  //           const decoder = new TextDecoder();
  //           const configMsg = JSON.parse(decoder.decode(payload));

  //           console.log('--configMsg--', configMsg);

  //           if (configMsg.videoConfig) {
  //             isWaitingForKeyFrame.current = true;
  //             const desc = Uint8Array.from(atob(configMsg.videoConfig.description), c => c.charCodeAt(0)).buffer;
  //             const codec = replaceNumbers(configMsg.videoConfig.codec);
  //             configMsg.videoConfig.codec = codec;

  //             // Lưu config lại để dùng cho việc phục hồi sau lỗi
  //             const videoConfig = { ...configMsg.videoConfig, description: desc };
  //             lastVideoConfigRef.current = videoConfig;

  //             if (videoDecoderRef.current && videoDecoderRef.current.state !== 'closed') {
  //               videoDecoderRef.current.configure(videoConfig);
  //             }
  //           }
  //           if (configMsg.audioConfig) {
  //             if (audioDecoderRef.current && audioDecoderRef.current.state !== 'closed') {
  //               const audioConfig = configMsg.audioConfig;
  //               audioDecoderRef.current.configure({
  //                 codec: audioConfig.codec,
  //                 sampleRate: audioConfig.sampleRate,
  //                 numberOfChannels: audioConfig.numberOfChannels,
  //               });
  //             }
  //           }
  //         } catch (e) {
  //           console.error('Config Error', e);
  //         }
  //         continue;
  //       }

  //       // HANDLE VIDEO
  //       if (frameType === 1 || frameType === 2) {
  //         // Kiểm tra kỹ trạng thái decoder trước khi gọi decode
  //         if (videoDecoderRef.current && videoDecoderRef.current.state === 'configured') {
  //           const isKeyFrame = frameType === 1;

  //           if (isWaitingForKeyFrame.current) {
  //             if (!isKeyFrame) continue; // Skip delta
  //             console.log('✅ Resumed decoding at KeyFrame');
  //             isWaitingForKeyFrame.current = false;
  //           }

  //           // Drop frame logic if decoder is overwhelmed
  //           if (videoDecoderRef.current.decodeQueueSize > 10 && !isKeyFrame) {
  //             continue;
  //           }

  //           try {
  //             videoDecoderRef.current.decode(
  //               new EncodedVideoChunk({
  //                 type: isKeyFrame ? 'key' : 'delta',
  //                 timestamp: timestamp * 1000,
  //                 data: payload,
  //               }),
  //             );
  //           } catch (decodeErr) {
  //             // Bắt lỗi decode đồng bộ (Synchronous errors)
  //             console.error('Decode call failed:', decodeErr);
  //             // Nếu lỗi State, buộc reset
  //             if (videoDecoderRef.current.state === 'closed') {
  //               // Trigger logic phục hồi (thường error callback sẽ chạy trước, nhưng phòng hờ)
  //               setupVideoDecoder();
  //               if (lastVideoConfigRef.current) videoDecoderRef.current.configure(lastVideoConfigRef.current);
  //               isWaitingForKeyFrame.current = true;
  //             }
  //           }
  //         }
  //       }
  //       // HANDLE AUDIO
  //       else if (frameType === 3) {
  //         if (audioDecoderRef.current && audioDecoderRef.current.state === 'configured') {
  //           try {
  //             audioDecoderRef.current.decode(
  //               new EncodedAudioChunk({
  //                 type: 'key',
  //                 timestamp: timestamp * 1000,
  //                 data: payload,
  //               }),
  //             );
  //           } catch (e) {
  //             console.error('Audio decode err', e);
  //           }
  //         }
  //       }
  //     } catch (error) {
  //       console.error('Stream loop error', error);
  //       break;
  //     }
  //   }
  // }, [initDecoders, playDecodedAudio, setupVideoDecoder]);

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
    canReceiveDataRef.current = false;
  }, []);

  return { mediaDecoder, resetDecoders, setCanReceiveData };
};
