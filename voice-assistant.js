
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { sb, showToast, viewStates, showView } from './app.js';

let liveSession = null;
let audioContext = null;
let scriptProcessor = null;
let stream = null;
let nextStartTime = 0;
const sources = new Set();

// Biến lưu trữ trạng thái hiển thị của lượt chat hiện tại
let currentAiResponse = "";
let currentStockSummary = ""; // Lưu phần chú thích Mã : SL

const SYSTEM_INSTRUCTION = `Bạn là trợ lý kho hàng thông minh cho J&J. 
Nhiệm vụ của bạn là giúp người dùng kiểm tra số lượng tồn kho. 

QUY TẮC PHẢN HỒI:
1. Nếu người dùng hỏi những câu không liên quan đến kiểm tra tồn kho vật tư, bạn PHẢI trả lời nguyên văn là: "Anh Tín chỉ dạy tôi đọc tồn kho, những thứ khác tôi chưa học tới".
2. Khi người dùng hỏi về một hoặc nhiều mã vật tư, hãy sử dụng công cụ 'get_inventory_stock'.
3. Báo cáo số lượng tồn kho của TỪNG MÃ riêng biệt. TUYỆT ĐỐI không cộng dồn tổng số lượng của các mã khác nhau lại với nhau.
4. Trả lời bằng tiếng Việt tự nhiên, ngắn gọn và chuyên nghiệp.`;

const getStockTool = {
    name: 'get_inventory_stock',
    parameters: {
        type: Type.OBJECT,
        description: 'Lấy số lượng tồn kho khả dụng của một hoặc nhiều mã vật tư cụ thể.',
        properties: {
            ma_vts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Danh sách các mã vật tư cần tra cứu (ví dụ: ["1962", "1961"]).',
            },
        },
        required: ['ma_vts'],
    },
};

// --- DRAGGABLE LOGIC ---
function makeDraggable(el, handle = el) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;
    handle.ontouchstart = dragMouseDown;

    function dragMouseDown(e) {
        if (['INPUT', 'BUTTON', 'TEXTAREA', 'A'].includes(e.target.tagName)) return;
        
        let clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        let clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        pos3 = clientX;
        pos4 = clientY;
        document.onmouseup = closeDragElement;
        document.ontouchend = closeDragElement;
        document.onmousemove = elementDrag;
        document.ontouchmove = elementDrag;
    }

    function elementDrag(e) {
        let clientX = e.clientX || (e.touches ? e.touches[0].clientX : 0);
        let clientY = e.clientY || (e.touches ? e.touches[0].clientY : 0);
        
        pos1 = pos3 - clientX;
        pos2 = pos4 - clientY;
        pos3 = clientX;
        pos4 = clientY;
        
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.bottom = 'auto';
        el.style.right = 'auto';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        document.ontouchend = null;
        document.ontouchmove = null;
    }
}

async function getInventoryStock(ma_vts) {
    try {
        const cleanVts = ma_vts.map(v => v.toUpperCase().trim());
        
        // 1. Kiểm tra danh sách sản phẩm hợp lệ
        const { data: validProducts, error: spError } = await sb.from('san_pham')
            .select('ma_vt')
            .in('ma_vt', cleanVts);
        
        if (spError) throw spError;
        const validSet = new Set((validProducts || []).map(p => p.ma_vt));

        // 2. Lấy số lượng tồn kho thực tế
        const { data: stockData, error: tkError } = await sb.from('ton_kho_update')
            .select('ma_vt, ton_cuoi')
            .in('ma_vt', cleanVts);
        
        if (tkError) throw tkError;
        
        const results = cleanVts.map(vt => {
            const isValid = validSet.has(vt);
            const items = (stockData || []).filter(d => d.ma_vt === vt);
            const total = items.reduce((sum, item) => sum + (item.ton_cuoi || 0), 0);
            
            let status = "VALID";
            if (!isValid) status = "INVALID";
            else if (total <= 0) status = "OUT_OF_STOCK";

            return { ma_vt: vt, ton_cuoi: total, status };
        });

        return { results };
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

// Hàm render giao diện chat AI
function updateAiChatUI(transcriptContainer) {
    let aiMsgBox = transcriptContainer.querySelector('.ai-msg-box');
    if (!aiMsgBox) {
        aiMsgBox = document.createElement('div');
        aiMsgBox.className = 'ai-msg-box text-left pt-2';
        transcriptContainer.innerHTML = ''; // Clear everything else
        transcriptContainer.appendChild(aiMsgBox);
    }

    let summaryHtml = "";
    if (currentStockSummary) {
        summaryHtml = `<div class="mb-2 p-2 bg-blue-50 rounded-xl border border-blue-100 text-[11px] space-y-0.5 shadow-sm animate-in fade-in duration-300">
            ${currentStockSummary}
        </div>`;
    }

    let textHtml = "";
    if (currentAiResponse) {
        textHtml = `
            <p class="text-indigo-600 font-bold text-[9px] uppercase tracking-wider mb-0.5">Trợ lý phản hồi:</p>
            <p class="text-gray-800 font-medium leading-relaxed italic text-[11px]">"${currentAiResponse}"</p>
        `;
    }

    aiMsgBox.innerHTML = summaryHtml + textHtml;
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
}

export async function startVoiceAssistant() {
    const panel = document.getElementById('voice-chat-panel');
    const statusText = document.getElementById('voice-status-text');
    const transcriptText = document.getElementById('voice-transcript-text');
    const pulseRing = document.getElementById('voice-pulse-ring');
    
    panel.classList.remove('hidden');
    statusText.textContent = "Đang khởi tạo...";
    statusText.classList.remove('text-red-500');
    transcriptText.textContent = "";
    currentAiResponse = ""; 
    currentStockSummary = "";

    try {
        const customApiKey = localStorage.getItem('gemini_voice_api_key');
        const apiKey = customApiKey || (typeof process !== 'undefined' && process.env?.API_KEY) || "AIzaSyCvro3yJ6eSNxkFM56coHwomzx_nH10-GY";

        const ai = new GoogleGenAI({ apiKey });
        
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        const inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
        
        if (inputAudioContext.state === 'suspended') await inputAudioContext.resume();
        if (outputAudioContext.state === 'suspended') await outputAudioContext.resume();

        audioContext = { input: inputAudioContext, output: outputAudioContext };

        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    statusText.textContent = "Mời bạn nói...";
                    pulseRing.classList.add('voice-pulse');
                    
                    const source = inputAudioContext.createMediaStreamSource(stream);
                    scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        
                        sessionPromise.then((session) => {
                            try {
                                if (session && liveSession) {
                                    session.sendRealtimeInput({ media: pcmBlob });
                                }
                            } catch (e) {}
                        });
                    };
                    source.connect(scriptProcessor);
                    scriptProcessor.connect(inputAudioContext.destination);
                },
                onmessage: async (message) => {
                    // Xử lý Audio Output
                    const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    if (base64EncodedAudioString) {
                        if (!statusText.textContent.includes("Đang lọc")) {
                            statusText.textContent = "Trợ lý đang trả lời...";
                        }
                        nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                        const audioBuffer = await decodeAudioData(decode(base64EncodedAudioString), outputAudioContext, 24000, 1);
                        const source = outputAudioContext.createBufferSource();
                        source.buffer = audioBuffer;
                        source.connect(outputAudioContext.destination);
                        source.addEventListener('ended', () => {
                            sources.delete(source);
                            if (sources.size === 0 && liveSession) {
                                if (!statusText.textContent.includes("Đang lọc")) {
                                    statusText.textContent = "Tôi đang nghe...";
                                }
                            }
                        });
                        source.start(nextStartTime);
                        nextStartTime = nextStartTime + audioBuffer.duration;
                        sources.add(source);
                    }

                    // Xử lý Transcription
                    if (message.serverContent?.inputTranscription) {
                        // Khi người dùng bắt đầu nói lượt mới, reset trạng thái
                        currentAiResponse = "";
                        currentStockSummary = "";
                        transcriptText.innerHTML = ""; 
                    } else if (message.serverContent?.outputTranscription) {
                        currentAiResponse += message.serverContent.outputTranscription.text;
                        updateAiChatUI(transcriptText);
                    }

                    // Xử lý Tool Call
                    if (message.toolCall) {
                        for (const fc of message.toolCall.functionCalls) {
                            if (fc.name === 'get_inventory_stock') {
                                const toolResult = await getInventoryStock(fc.args.ma_vts);
                                const results = toolResult.results || [];
                                const foundVts = results.filter(r => r.status === "VALID" || r.status === "OUT_OF_STOCK").map(r => r.ma_vt);
                                
                                // Tạo nội dung chú thích (Mã : SL)
                                currentStockSummary = results.map(r => {
                                    if (r.status === "VALID") {
                                        return `<p class="font-bold text-gray-700">Mã ${r.ma_vt} : <span class="text-blue-600">${r.ton_cuoi.toLocaleString()}</span></p>`;
                                    } else if (r.status === "OUT_OF_STOCK") {
                                        return `<p class="font-bold text-gray-400">Mã ${r.ma_vt} : <span class="text-red-400 uppercase">Hết</span></p>`;
                                    } else {
                                        return `<p class="font-bold text-gray-300 italic">Mã ${r.ma_vt} : <span class="text-gray-400 uppercase text-[9px]">Mã không hợp lệ</span></p>`;
                                    }
                                }).join('');

                                // Cập nhật UI ngay lập tức
                                updateAiChatUI(transcriptText);

                                if (foundVts.length > 0) {
                                    const state = viewStates['view-ton-kho'];
                                    state.searchTerm = '';
                                    state.filters = { ma_vt: foundVts, lot: [], date: [], tinh_trang: [], nganh: [], phu_trach: [] };
                                    state.stockAvailability = 'all'; // Đổi thành all để xem được cả mã hết hàng
                                    sessionStorage.setItem('tonKhoStockAvailability', 'all');
                                    
                                    statusText.textContent = `Đang lọc: ${foundVts.join(', ')}`;
                                    statusText.classList.add('text-green-600');
                                    
                                    showView('view-ton-kho').then(() => {
                                        import('./tonkho.js').then(m => m.fetchTonKho(1));
                                    });
                                }

                                sessionPromise.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: fc.id,
                                            name: fc.name,
                                            response: { result: toolResult },
                                        }
                                    });
                                });
                            }
                        }
                    }

                    if (message.serverContent?.interrupted) {
                        for (const source of sources.values()) { try { source.stop(); } catch(e) {} }
                        sources.clear();
                        nextStartTime = 0;
                        currentAiResponse = ""; 
                    }
                },
                onerror: (e) => {
                    console.error("Live API Error:", e);
                    const msg = e.message || "";
                    if (msg.includes("429") || msg.includes("quota") || msg.includes("limit") || msg.includes("Requested entity was not found")) {
                        statusText.innerHTML = "Key API hết lượt dùng, vui lòng cập nhật Key mới trong cài đặt.";
                        statusText.classList.add('text-red-500');
                        pulseRing.classList.remove('bg-green-400');
                        pulseRing.classList.add('bg-red-500');
                    } else {
                        statusText.textContent = "Lỗi kết nối!";
                    }
                },
                onclose: (e) => {
                    statusText.textContent = "Đã ngắt kết nối.";
                    pulseRing.classList.remove('voice-pulse');
                    currentAiResponse = "";
                },
            },
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
        });

        liveSession = await sessionPromise;

    } catch (err) {
        console.error("Assistant Start Error:", err);
        statusText.textContent = "Lỗi khởi động!";
        transcriptText.textContent = err.message;
    }
}

export function stopVoiceAssistant() {
    if (scriptProcessor) {
        try { scriptProcessor.disconnect(); scriptProcessor.onaudioprocess = null; } catch (e) {}
        scriptProcessor = null;
    }
    if (liveSession) {
        try { liveSession.close(); } catch (e) {}
        liveSession = null;
    }
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    if (audioContext) {
        try {
            if (audioContext.input.state !== 'closed') audioContext.input.close();
            if (audioContext.output.state !== 'closed') audioContext.output.close();
        } catch (e) {}
        audioContext = null;
    }
    for (const source of sources.values()) { try { source.stop(); } catch(e) {} }
    sources.clear();
    nextStartTime = 0;
    currentAiResponse = "";
    const panel = document.getElementById('voice-chat-panel');
    if (panel) panel.classList.add('hidden');
}

// Initialization of Draggability and Settings
document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('voice-assistant-trigger');
    const panel = document.getElementById('voice-chat-panel');
    const header = document.getElementById('voice-chat-header');
    
    if (trigger) makeDraggable(trigger);
    if (panel && header) makeDraggable(panel, header);

    // API Key Settings Logic
    const settingsBtn = document.getElementById('open-voice-settings-btn');
    const settingsModal = document.getElementById('voice-settings-modal');
    const closeSettingsBtn = document.getElementById('close-voice-settings-modal');
    const saveSettingsBtn = document.getElementById('save-voice-settings-btn');
    const keyInput = document.getElementById('voice-api-key-input');

    if (settingsBtn) {
        settingsBtn.onclick = () => {
            keyInput.value = localStorage.getItem('gemini_voice_api_key') || "";
            settingsModal.classList.remove('hidden');
        };
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.onclick = () => settingsModal.classList.add('hidden');
    }

    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = () => {
            const val = keyInput.value.trim();
            if (val) {
                localStorage.setItem('gemini_voice_api_key', val);
                showToast("Đã cập nhật API Key!", "success");
            } else {
                localStorage.removeItem('gemini_voice_api_key');
                showToast("Đã quay lại Key mặc định.", "info");
            }
            settingsModal.classList.add('hidden');
            if (liveSession) {
                stopVoiceAssistant();
                setTimeout(startVoiceAssistant, 300);
            }
        };
    }
});
