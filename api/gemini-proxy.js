<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Asistente de Voz y Texto Gemini</title>
    <!-- Incluyendo Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7f9fb;
        }
        /* Estilos de burbuja */
        .assistant-bubble {
            background-color: #e0f2f1; /* Teal 50 */
            border-radius: 1.5rem 1.5rem 1.5rem 0.5rem;
            padding: 1rem;
            max-width: 85%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            line-height: 1.6;
            word-wrap: break-word;
        }
        .user-bubble {
            background-color: #3b82f6; /* Blue 500 */
            color: white;
            border-radius: 1.5rem 1.5rem 0.5rem 1.5rem;
            padding: 1rem;
            max-width: 85%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            line-height: 1.6;
            word-wrap: break-word;
        }
        .error-bubble {
            background-color: #fee2e2; /* Red 100 */
            color: #b91c1c; /* Red 700 */
            border-radius: 1.5rem;
            padding: 1rem;
            max-width: 95%;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            line-height: 1.6;
        }
        /* Animación de carga (puntos) */
        .loading-dot {
            animation: bounce 0.6s infinite alternate;
        }
        .loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .loading-dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
            from { transform: translateY(0); }
            to { transform: translateY(-8px); }
        }
        /* Animación de escucha (micrófono) */
        .is-listening {
            animation: pulse 1s infinite;
        }
        @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(20, 184, 166, 0); }
            100% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0); }
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">

    <div id="app" class="w-full max-w-2xl bg-white rounded-xl shadow-2xl flex flex-col h-[80vh]">

        <!-- Encabezado -->
        <header class="p-4 border-b border-gray-100 bg-teal-600 rounded-t-xl">
            <h1 class="text-xl font-bold text-white">Asistente de Voz y Texto</h1>
            <p class="text-sm text-teal-200">Escribe o habla tu consulta. La respuesta se leerá en voz alta.</p>
        </header>

        <!-- Área de Conversación -->
        <main id="chat-window" class="flex-grow p-4 overflow-y-auto space-y-4">
            <!-- Mensaje de Bienvenida -->
            <div class="flex justify-start">
                <div class="assistant-bubble">
                    Hola! Soy tu asistente. ¡Puedes hablarme o escribirme!
                </div>
            </div>
            <!-- Los mensajes se añadirán aquí -->
        </main>

        <!-- Indicador de Carga/Estado -->
        <div id="status-indicator" class="p-3 flex justify-start items-center space-x-3 hidden">
            <i id="status-icon" class="fas fa-magic text-teal-500"></i>
            <span id="status-text" class="text-sm text-gray-500">Generando respuesta...</span>
            <div id="loading-dots" class="flex space-x-1">
                <div class="w-2 h-2 bg-teal-500 rounded-full loading-dot"></div>
                <div class="w-2 h-2 bg-teal-500 rounded-full loading-dot"></div>
                <div class="w-2 h-2 bg-teal-500 rounded-full loading-dot"></div>
            </div>
        </div>

        <!-- Área de Entrada -->
        <footer class="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl">
            <div class="flex space-x-3 items-center">
                <input
                    type="text"
                    id="user-input"
                    class="flex-grow p-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition duration-150"
                    placeholder="Escribe o presiona el micrófono..."
                    onkeypress="if(event.key === 'Enter') handleQuery()"
                >
                <button
                    id="mic-button"
                    onclick="toggleSpeechInput()"
                    class="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition duration-150 shadow-md disabled:opacity-50"
                    title="Hablar (Speech-to-Text)"
                >
                    <i class="fas fa-microphone"></i>
                </button>
                <button
                    id="send-button"
                    onclick="handleQuery()"
                    class="px-5 py-3 bg-teal-600 text-white font-semibold rounded-full hover:bg-teal-700 transition duration-150 shadow-md disabled:opacity-50"
                    title="Enviar consulta"
                >
                    <i class="fas fa-paper-plane"></i>
                </button>
            </div>
        </footer>
    </div>

    <script>
        // --- CONSTANTES Y CONFIGURACIÓN ---
        
        // **IMPORTANTE**: Para Vercel, la URL de la API de Gemini AHORA será
        // el punto final de tu Serverless Function.
        // La clave de API se maneja dentro de gemini-proxy.js (lado del servidor).
        const PROXY_URL = '/api/gemini-proxy'; 
        
        // Como el TTS no tiene una Serverless Function de proxy, seguirá usando 
        // la clave inyectada para el entorno Canvas o fallará en Vercel.
        // La voz de Gemini no se podrá usar de forma segura sin un proxy dedicado.

        const TTS_API_MODEL = 'gemini-2.5-flash-preview-tts';

        // Elementos UI
        const chatWindow = document.getElementById('chat-window');
        const userInput = document.getElementById('user-input');
        const sendButton = document.getElementById('send-button');
        const micButton = document.getElementById('mic-button');
        const statusIndicator = document.getElementById('status-indicator');
        const statusText = document.getElementById('status-text');
        const statusIcon = document.getElementById('status-icon');
        const loadingDots = document.getElementById('loading-dots');

        // Estado y Servicios
        let isListening = false;
        let recognition = null;
        let audioContext = null;
        
        // --- FUNCIÓN PARA OBTENER CLAVE (SOLO para TTS en Canvas) ---
        // Se mantiene para el entorno Canvas y el servicio TTS que no usa proxy.
        function getApiKey() {
            if (typeof __api_key !== 'undefined' && __api_key.length > 0) {
                return __api_key;
            }
            // En Vercel, este valor será vacío, lo que desactivará el TTS de alta calidad 
            // y obligará a usar el fallback nativo (más seguro).
            return ''; 
        }

        const apiKey = getApiKey(); 
        const ttsApiUrl = apiKey ? `https://generativelanguage.googleapis.com/v1beta/models/${TTS_API_MODEL}:generateContent?key=${apiKey}` : '';


        // --- FUNCIONES DE UTILIDAD (PCM a WAV) ---
        
        function base64ToArrayBuffer(base64) {
            const binaryString = window.atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        }

        function writeString(view, offset, string) {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        }

        function writeHeaders(view, sampleRate, numberOfChannels, bytesPerSample, dataLength) {
            // RIFF chunk descriptor
            writeString(view, 0, 'RIFF');
            view.setUint32(4, 36 + dataLength, true); // Total size
            writeString(view, 8, 'WAVE');

            // fmt sub-chunk
            writeString(view, 12, 'fmt ');
            view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
            view.setUint16(20, 1, true); // Audio format (1 for PCM)
            view.setUint16(22, numberOfChannels, true); // Number of channels
            view.setUint32(24, sampleRate, true); // Sample rate
            view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true); // Byte rate
            view.setUint16(32, numberOfChannels * bytesPerSample, true); // Block align
            view.setUint16(34, bytesPerSample * 8, true); // Bits per sample

            // data sub-chunk
            writeString(view, 36, 'data');
            view.setUint32(40, dataLength, true); // Data size
        }

        function pcmToWav(pcm16, sampleRate) {
            const numberOfChannels = 1;
            const bytesPerSample = 2; // 16-bit PCM (L16)

            const dataLength = pcm16.length * bytesPerSample;
            const buffer = new ArrayBuffer(44 + dataLength);
            const view = new DataView(buffer);

            writeHeaders(view, sampleRate, numberOfChannels, bytesPerSample, dataLength);

            // Copy PCM data
            const pcm8 = new Uint8Array(pcm16.buffer);
            const dataOffset = 44;
            for (let i = 0; i < pcm8.length; i++) {
                view.setUint8(dataOffset + i, pcm8[i]);
            }

            return new Blob([view], { type: 'audio/wav' });
        }


        // --- FUNCIONES DE UI Y CHAT ---

        function ensureAudioContext() {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
        }

        function setUIState(isDisabled, status = '', icon = '', showDots = true) {
            userInput.disabled = isDisabled;
            sendButton.disabled = isDisabled;
            micButton.disabled = isDisabled;

            if (status) {
                statusIndicator.classList.remove('hidden');
                statusText.textContent = status;
                statusIcon.className = `text-teal-500 ${icon}`;
                loadingDots.classList.toggle('hidden', !showDots);
            } else {
                statusIndicator.classList.add('hidden');
            }
        }

        function updateChat(text, sender) {
            const messageContainer = document.createElement('div');
            messageContainer.className = sender === 'user' ? 'flex justify-end' : 'flex justify-start';

            const messageBubble = document.createElement('div');
            
            if (sender === 'user') {
                messageBubble.className = 'user-bubble';
            } else if (sender === 'assistant') {
                messageBubble.className = 'assistant-bubble relative';
            } else if (sender === 'error') {
                 messageBubble.className = 'error-bubble relative';
            }

            let htmlText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            htmlText = htmlText.replace(/\n/g, '<br>');

            messageBubble.innerHTML = htmlText;

            // Añadir icono de audio para el asistente si no es un error
            if (sender === 'assistant' || (sender === 'error' && text.includes("voz nativa"))) {
                const audioIcon = document.createElement('i');
                audioIcon.className = 'fas fa-volume-up text-teal-700 ml-2 cursor-pointer transition duration-150 hover:text-teal-900 absolute -right-6 top-1';
                audioIcon.title = 'Escuchar respuesta';
                audioIcon.onclick = () => speakResponse(text);
                messageBubble.appendChild(audioIcon);
            }

            messageContainer.appendChild(messageBubble);
            chatWindow.appendChild(messageContainer);

            chatWindow.scrollTop = chatWindow.scrollHeight;
            return messageBubble;
        }

        // --- FUNCIONES DE VOZ (TTS y STT) ---
        
        /** Fallback: Usa la API nativa de Síntesis de Voz del navegador. */
        function speakFallback(text) {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel(); 
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'es-ES'; 
                
                const spanishVoice = window.speechSynthesis.getVoices().find(voice => voice.lang.startsWith('es'));
                if (spanishVoice) {
                    utterance.voice = spanishVoice;
                }

                window.speechSynthesis.speak(utterance);
                
                utterance.onend = () => {
                    setUIState(false);
                };
                utterance.onerror = (e) => {
                    console.error("Error en TTS nativo:", e);
                    setUIState(false);
                };
            } else {
                console.error("El navegador no soporta la API nativa de Speech Synthesis.");
                setUIState(false);
            }
        }

        /**
         * Llama a la API de Gemini para generar el audio TTS y lo reproduce.
         * En Vercel, este servicio fallará si no hay clave visible, 
         * y automáticamente usará el fallback nativo, que es seguro.
         * @param {string} text - El texto a convertir a voz.
         */
        async function speakResponse(text) {
            if (!apiKey) {
                // Si no hay clave, forzamos el fallback
                updateChat("TTS: La clave de API no está configurada (o no es visible en el cliente). Usando la voz nativa.", 'error');
                speakFallback(text);
                return;
            }

            // Si hay clave (solo ocurre en el entorno Canvas)
            ensureAudioContext();
            setUIState(true, 'Generando voz...', 'fas fa-volume-up', true);

            let audioPlayedSuccessfully = false; 

            const ttsPayload = {
                contents: [{ parts: [{ text: text }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: "Kore" } 
                        }
                    }
                },
                systemInstruction: {
                    parts: [{ text: "Responde siempre en español. La voz generada debe ser en español de España (es-ES)." }]
                }
            };

            try {
                const response = await fetch(ttsApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ttsPayload)
                });

                if (!response.ok) {
                    const status = response.status;
                    if (status === 401 || status === 403) {
                        throw new Error("TTS Authorization Error (401/403)");
                    }
                    throw new Error(`TTS API error: ${status} ${response.statusText}`);
                }
                
                const result = await response.json();
                const part = result?.candidates?.[0]?.content?.parts?.[0];
                const audioData = part?.inlineData?.data; 
                const mimeType = part?.inlineData?.mimeType;

                if (audioData && mimeType && mimeType.startsWith("audio/L16")) {
                    const match = mimeType.match(/rate=(\d+)/);
                    const sampleRate = match ? parseInt(match[1], 10) : 24000; 

                    const pcmData = base64ToArrayBuffer(audioData);
                    const pcm16 = new Int16Array(pcmData);
                    const wavBlob = pcmToWav(pcm16, sampleRate);
                    const audioUrl = URL.createObjectURL(wavBlob);

                    const audio = new Audio(audioUrl);
                    
                    await new Promise((resolve, reject) => {
                        audio.onended = () => {
                            URL.revokeObjectURL(audioUrl);
                            audioPlayedSuccessfully = true;
                            resolve();
                        };
                        audio.onerror = (e) => {
                            URL.revokeObjectURL(audioUrl);
                            reject(new Error("Error de reproducción de audio."));
                        };
                        audio.play().catch(e => reject(new Error(`Error al iniciar la reproducción: ${e.message}`)));
                    });
                    
                } else {
                    throw new Error("Respuesta de audio TTS incompleta o formato incorrecto.");
                }

            } catch (error) {
                console.error("Error al generar o reproducir TTS:", error);
                
                if (error.message.includes("401") || error.message.includes("403") || error.message.includes("Authorization Error")) {
                    // Si falla por autorización, usamos el fallback
                    updateChat("Fallo de Autorización (401/403) para el servicio de voz de Gemini. Usando la voz nativa del navegador como alternativa.", 'error');
                    speakFallback(text);
                    audioPlayedSuccessfully = true; 
                } else {
                    updateChat("No se pudo generar la voz. Revisa la consola para más detalles.", 'error');
                }
            } finally {
                if (!audioPlayedSuccessfully) {
                    setUIState(false);
                }
            }
        }

        function toggleSpeechInput() {
            if (!('webkitSpeechRecognition' in window)) {
                updateChat("Tu navegador no soporta el reconocimiento de voz. Usa la entrada de texto.", 'error');
                return;
            }

            if (!recognition) {
                recognition = new webkitSpeechRecognition();
                recognition.continuous = false;
                recognition.lang = 'es-ES'; 
                recognition.interimResults = false;
            }

            if (isListening) {
                recognition.stop();
                setUIState(false);
                micButton.classList.remove('is-listening', 'bg-red-700');
                micButton.classList.add('bg-red-500');
                isListening = false;
                return;
            }
            
            recognition.start();
            isListening = true;
            micButton.classList.add('is-listening', 'bg-red-700');
            micButton.classList.remove('bg-red-500');
            setUIState(true, 'Escuchando... Di algo.', 'fas fa-microphone', false);
            userInput.value = ''; 

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                userInput.value = transcript;
            };
            
            recognition.onend = () => {
                if (isListening) {
                    isListening = false;
                    micButton.classList.remove('is-listening', 'bg-red-700');
                    micButton.classList.add('bg-red-500');
                    setUIState(false);
                    if (userInput.value.trim()) {
                        handleQuery();
                    }
                }
            };

            recognition.onerror = (event) => {
                console.error('Error de reconocimiento de voz:', event.error);
                recognition.stop();
                micButton.classList.remove('is-listening', 'bg-red-700');
                micButton.classList.add('bg-red-500');
                updateChat(`Error en la entrada de voz: ${event.error}.`, 'error');
            };
        }


        // --- FUNCIONES DE API Y LÓGICA PRINCIPAL (Ahora usando PROXY) ---

        async function fetchWithBackoff(userQuery, attempt = 0) {
            const MAX_RETRIES = 5;
            const BASE_DELAY = 1000; 

            // Construimos el payload completo para enviarlo al proxy
            const payload = {
                contents: [{ parts: [{ text: userQuery }] }],
                tools: [{ "google_search": {} }],
                systemInstruction: {
                    parts: [{ text: "Actúa como un asistente profesional y conciso. Responde a las preguntas en español. Siempre utiliza la información más reciente de Google Search para fundamentar tus respuestas." }]
                },
            };

            try {
                // Llamamos a nuestro proxy en Vercel
                const response = await fetch(PROXY_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
                    const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * 500;
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return fetchWithBackoff(userQuery, attempt + 1);
                }

                if (!response.ok) {
                    const status = response.status;
                    const errorJson = await response.json();
                    
                    if (status === 500 && errorJson.error && errorJson.error.includes("GEMINI_API_KEY")) {
                         throw new Error(`Error de Vercel: La variable de entorno GEMINI_API_KEY no está configurada. ${errorJson.error}`);
                    }
                    
                    throw new Error(`Error ${status}: La llamada al proxy falló. Detalles: ${errorJson.error || 'Verifica el log del servidor de Vercel.'}`);
                }

                return await response.json();

            } catch (error) {
                if (attempt < MAX_RETRIES) {
                    throw error;
                }
                console.error("Error final después de múltiples reintentos:", error);
                throw new Error(`Lo siento, no pude comunicarme con el servidor. Por favor, revisa la configuración del proxy en Vercel.`);
            }
        }

        async function handleQuery() {
            const prompt = userInput.value.trim();
            if (!prompt) return;

            userInput.value = '';
            setUIState(true, 'Generando respuesta...', 'fas fa-brain', true);

            updateChat(prompt, 'user');

            try {
                const result = await fetchWithBackoff(prompt);
                const candidate = result.candidates?.[0];

                let assistantResponse = "Lo siento, hubo un problema al generar la respuesta.";

                if (candidate && candidate.content?.parts?.[0]?.text) {
                    assistantResponse = candidate.content.parts[0].text;
                } else if (result.error) {
                    assistantResponse = `Error de API: ${result.error.message}`;
                    console.error("Error de la API en el resultado:", result.error);
                }

                updateChat(assistantResponse, 'assistant');
                await speakResponse(assistantResponse);

            } catch (error) {
                const errorMessage = error.message || "Ocurrió un error desconocido.";
                    
                updateChat(`**¡Falló la Conexión!** ${errorMessage}`, 'error');
                console.error("Error crítico en handleQuery:", error);
                setUIState(false);
            }
        }

        window.onload = () => {
            userInput.focus();
            if (apiKey) {
                 updateChat("Nota: Estás usando la clave de API inyectada (solo funciona en este entorno). Para Vercel, asegúrate de haber implementado el proxy.", 'error');
            }
        };

    </script>
</body>
</html>