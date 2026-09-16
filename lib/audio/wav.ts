/**
 * 16-bit PCM WAV 编码与 base64 转换。
 *
 * 浏览器 MediaRecorder 通常只能录出 WebM/Opus 或 MP4/AAC 容器，语音识别接口对
 * 这两者的支持并不一致。这里统一在浏览器本地转成 16kHz 单声道 WAV 再上传，
 * 让服务端拿到的格式始终确定。
 *
 * 本文件保持纯函数，不依赖 window、AudioContext 或 Buffer，便于单测。
 */

export const WAV_HEADER_BYTES = 44;
export const WAV_BITS_PER_SAMPLE = 16;
export const WAV_CHANNEL_COUNT = 1;
/** 语音识别常用采样率；16kHz 单声道每秒约 32KB，60 秒约 1.9MB。 */
export const WAV_TARGET_SAMPLE_RATE = 16_000;

const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) {
    view.setUint8(offset + index, text.charCodeAt(index));
  }
}

/** 把 -1..1 的浮点采样转成 16 位有符号整数，超出范围按边界截断。 */
export function floatToPcm16(sample: number) {
  if (!Number.isFinite(sample)) return 0;
  const clamped = Math.max(-1, Math.min(1, sample));
  return Math.round(clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff);
}

/**
 * 把单声道浮点采样编码成标准 44 字节头的 WAV。
 * sampleRate 必须是正整数，samples 允许为空（生成只有头部的合法 WAV）。
 */
export function encodeWavPcm16(samples: Float32Array, sampleRate: number) {
  if (!Number.isSafeInteger(sampleRate) || sampleRate <= 0) {
    throw new RangeError("sampleRate must be a positive integer");
  }
  const bytesPerSample = WAV_BITS_PER_SAMPLE / 8;
  const dataBytes = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(WAV_HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, WAV_CHANNEL_COUNT, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * WAV_CHANNEL_COUNT * bytesPerSample, true);
  view.setUint16(32, WAV_CHANNEL_COUNT * bytesPerSample, true);
  view.setUint16(34, WAV_BITS_PER_SAMPLE, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataBytes, true);

  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(WAV_HEADER_BYTES + index * bytesPerSample, floatToPcm16(samples[index]), true);
  }

  return new Uint8Array(buffer);
}

/** 不依赖 btoa/Buffer 的 base64 编码，便于在任意环境复用与测试。 */
export function bytesToBase64(bytes: Uint8Array) {
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;

    output += BASE64_ALPHABET[first >> 2];
    output += BASE64_ALPHABET[((first & 0x03) << 4) | (second >> 4)];
    output += index + 1 < bytes.length ? BASE64_ALPHABET[((second & 0x0f) << 2) | (third >> 6)] : "=";
    output += index + 2 < bytes.length ? BASE64_ALPHABET[third & 0x3f] : "=";
  }
  return output;
}
