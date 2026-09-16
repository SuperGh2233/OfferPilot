import { describe, expect, it } from "vitest";

import {
  bytesToBase64,
  encodeWavPcm16,
  floatToPcm16,
  WAV_HEADER_BYTES,
} from "../lib/audio/wav";

function ascii(view: DataView, offset: number, length: number) {
  let text = "";
  for (let index = 0; index < length; index += 1) {
    text += String.fromCharCode(view.getUint8(offset + index));
  }
  return text;
}

describe("encodeWavPcm16", () => {
  it("writes a 16kHz mono 16-bit PCM header", () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const bytes = encodeWavPcm16(samples, 16_000);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dataBytes = samples.length * 2;

    expect(bytes.length).toBe(WAV_HEADER_BYTES + dataBytes);
    expect(ascii(view, 0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(36 + dataBytes);
    expect(ascii(view, 8, 4)).toBe("WAVE");
    expect(ascii(view, 12, 4)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(28, true)).toBe(32_000);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(view, 36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(dataBytes);
  });

  it("clamps and rounds samples into the signed 16-bit range", () => {
    expect(floatToPcm16(0)).toBe(0);
    expect(floatToPcm16(1)).toBe(32767);
    expect(floatToPcm16(-1)).toBe(-32768);
    expect(floatToPcm16(2)).toBe(32767);
    expect(floatToPcm16(-3)).toBe(-32768);
    expect(floatToPcm16(Number.NaN)).toBe(0);
    expect(floatToPcm16(Number.POSITIVE_INFINITY)).toBe(0);

    const bytes = encodeWavPcm16(new Float32Array([1, -1]), 16_000);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getInt16(WAV_HEADER_BYTES, true)).toBe(32767);
    expect(view.getInt16(WAV_HEADER_BYTES + 2, true)).toBe(-32768);
  });

  it("keeps an empty recording a valid header-only wav", () => {
    const bytes = encodeWavPcm16(new Float32Array(0), 16_000);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    expect(bytes.length).toBe(WAV_HEADER_BYTES);
    expect(view.getUint32(40, true)).toBe(0);
  });

  it("rejects an invalid sample rate", () => {
    expect(() => encodeWavPcm16(new Float32Array(0), 0)).toThrow(RangeError);
    expect(() => encodeWavPcm16(new Float32Array(0), -1)).toThrow(RangeError);
    expect(() => encodeWavPcm16(new Float32Array(0), 16_000.5)).toThrow(RangeError);
  });
});

describe("bytesToBase64", () => {
  it("encodes every tail length with the correct padding", () => {
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
    expect(bytesToBase64(new Uint8Array([0x66]))).toBe("Zg==");
    expect(bytesToBase64(new Uint8Array([0x66, 0x6f]))).toBe("Zm8=");
    expect(bytesToBase64(new Uint8Array([0x66, 0x6f, 0x6f]))).toBe("Zm9v");
    expect(bytesToBase64(new Uint8Array([0x66, 0x6f, 0x6f, 0x62]))).toBe("Zm9vYg==");
  });

  it("matches the platform encoder for arbitrary bytes", () => {
    const bytes = new Uint8Array(257);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 37) % 256;
    }
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
  });
});
