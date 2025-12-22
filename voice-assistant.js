
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { sb, showToast } from './app.js';

let liveSession = null;
let audioContext = null;
let stream = null;
let nextStartTime = 0;
const sources = new Set();

const SYSTEM_INSTRUCTION = `Bạn là trợ lý kho hàng thông minh cho J&J. 
Nhiệm vụ của bạn là giúp người dùng kiểm tra số lượng tồn kho của các mã vật tư (Mã VT). 
Khi người dùng hỏi về một mã nào đó (ví dụ: "Số lượng của mã 123456 là bao nhiêu?"), hãy sử dụng công cụ 'get_inventory_stock' để tra cứu.
Trả lời bằng tiếng Việt tự nhiên, ngắn gọn và chính xác. 
Nếu mã vật tư không tồn tại, hãy thông báo lịch sự.
Luôn cộng dồn tổng số lượng nếu mã đó có nhiều Lot khác nhau.`;

const getStockTool = {
    name: 'get_inventory_stock',
    parameters: {
        type: Type.OBJECT,
        description: 'Lấy tổng số lượng tồn kho cuối cùng của một mã vật tư cụ thể.',
        properties: {
            ma_vt: {
                type: Type.STRING,
                description: 'Mã vật tư cần tra cứu (ví dụ: "123456", "VTV01").',
            },
        },
        required: ['ma_vt'],
    },
};

async function getInventoryStock(ma_vt) {
    try {
        const { data, error } = await sb.from('ton_kho_update')
            .select('ton_cuoi')
            .eq('ma_vt', ma_vt.toUpperCase().trim());
        
        if (error) throw error;
        
        const total = (data || []).reduce((sum, item) => sum + (item.ton_cuoi || 0), 0);
        return { ma_vt, ton_cuoi: total, found: (data && data.length > 0) };
    } catch (err) {
        console.error("Tool Error:", err);
        return { error: "Lỗi kết nối cơ sở dữ liệu." };
    }
}

function encode(bytes) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(data, ctx, sampleRate, numChannels) {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

export async function startVoiceAssistant() {
    const panel = document.getElementById('voice-chat-panel');
    const statusText = document.getElementById('voice-status-text');
    const transcriptText = document.getElementById('voice-transcript-text');
    const pulseRing = document.getElementById('voice-pulse-ring');
    
    panel.classList.remove('hidden');
    statusText.textContent = "Đang khởi tạo...";
    transcriptText.textContent = "";

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        statusText.textContent = "Đang mở Microphone...";
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const outputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        
        if (inputCtx.state === 'suspended') await inputCtx.resume();
        if (outputCtx.state === 'suspended') await outputCtx.resume();

        audioContext = { input: inputCtx, output: outputCtx };

        statusText.textContent = "Đang kết nối Gemini...";

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
                },
                systemInstruction: SYSTEM_INSTRUCTION,
                tools: [{ functionDeclarations: [getStockTool] }],
                outputAudioTranscription: {},
                inputAudioTranscription: {}
            },
            callbacks: {
                onopen: () => {
                    statusText.textContent = "Mời bạn nói...";
                    pulseRing.classList.add('voice-pulse');
                    
                    const source = inputCtx.createMediaStreamSource(stream);
                    const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputCtx.destination);
                },
                onmessage: async (message) => {
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64Audio) {
                        statusText.textContent = "Trợ lý đang phản hồi...";
                        nextStartTime = Math.max(nextStartTime, outputCtx.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                        const source = outputCtx.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputCtx.destination);
                        source.start(nextStartTime);
                        nextStartTime += audioBuffer.duration;
                        sources.add(source);
                        source.onended = () => {
                            sources.delete(source);
                            if (sources.size === 0) statusText.textContent = "Đang lắng nghe...";
                        };
                    }

                    if (message.serverContent?.inputTranscription) {
                        transcriptText.textContent = `Bạn: "${message.serverContent.inputTranscription.text}"`;
                    }
                    if (message.serverContent?.outputTranscription) {
                        transcriptText.textContent = `AI: "${message.serverContent.outputTranscription.text}"`;
                    }

                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            if (fc.name === 'get_inventory_stock') {
                                statusText.textContent = "Đang tra cứu kho...";
                                const result = await getInventoryStock(fc.args.ma_vt);
                                sessionPromise.then(s => s.sendToolResponse({
                                    functionResponses: { id: fc.id, name: fc.name, response: { result } }
                                }));
                            }
                        }
                    }

                    if (message.serverContent?.interrupted) {
                        sources.forEach(s => { try { s.stop(); } catch(e){} });
                        sources.clear();
                        nextStartTime = 0;
                    }
                },
                onerror: (e) => {
                    console.error("Live API Error:", e);
                    statusText.textContent = "Lỗi kết nối!";
                },
                onclose: () => {
                    statusText.textContent = "Kết thúc.";
                    pulseRing.classList.remove('voice-pulse');
                }
            }
        });

        liveSession = await sessionPromise;

    } catch (err) {
        console.error("Assistant Start Error:", err);
        statusText.textContent = "Lỗi!";
        transcriptText.textContent = "Không thể khởi động trợ lý giọng nói. Vui lòng kiểm tra quyền micro.";
    }
}

export function stopVoiceAssistant() {
    if (liveSession) {
        try { liveSession.close(); } catch(e) {}
        liveSession = null;
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (audioContext) {
        if (audioContext.input) audioContext.input.close();
        if (audioContext.output) audioContext.output.close();
        audioContext = null;
    }
    sources.forEach(s => { try { s.stop(); } catch(e){} });
    sources.clear();
    nextStartTime = 0;
    
    const panel = document.getElementById('voice-chat-panel');
    if (panel) panel.classList.add('hidden');
}
