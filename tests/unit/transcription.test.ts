import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeMonoPcm16Wav } from "@/lib/audio/wav";
import { GeminiTranscriptionProvider } from "@/lib/transcription/gemini-provider";

describe("Gemini 語音辨識", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("將瀏覽器音訊編碼成 16kHz 單聲道 PCM WAV", async () => {
    const wav = encodeMonoPcm16Wav([new Float32Array(48_000).fill(0.25)], 48_000);
    const view = new DataView(await wav.arrayBuffer());
    expect(wav.type).toBe("audio/wav");
    expect(new TextDecoder().decode(new Uint8Array(view.buffer, 0, 4))).toBe("RIFF");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint32(40, true)).toBe(32_000);
  });

  it("將 WAV 傳給 Gemini 並回傳純文字逐字稿", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-test");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "逐字稿：今天幫番茄澆水。" }] } }] }), { status: 200 }));
    const result = await new GeminiTranscriptionProvider().transcribe(new File([new Uint8Array([1, 2])], "recording.wav", { type: "audio/wav" }));
    expect(result.text).toBe("今天幫番茄澆水。");
    expect(result.provider).toBe("gemini");
    expect(fetchMock).toHaveBeenCalledOnce();
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(request.contents[0].parts[1].inlineData.mimeType).toBe("audio/wav");
  });
});
