/**
 * Función Proxy para Vercel (Node.js) que maneja las llamadas a la API de Gemini.
 * * Esta función está diseñada para:
 * 1. Manejar la generación de texto (usando Google Search grounding) con gemini-2.5-flash-preview-09-2025.
 * 2. Manejar la generación de voz (TTS) con gemini-2.5-flash-preview-tts si se detecta el flag 'isTTS: true' en el body.
 * * Se asume que tienes una variable de entorno configurada en Vercel:
 * GEMINI_API_KEY
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

module.exports = async (req, res) => {
    // Solo acepta peticiones POST
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método no permitido. Usa POST.' });
        return;
    }

    // Encabezados de CORS para permitir la comunicación con el frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Manejar preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { prompt, isTTS, systemInstruction, voiceName } = req.body;

        if (!prompt) {
            res.status(400).json({ error: 'Falta el campo "prompt" en la solicitud.' });
            return;
        }

        let apiUrl;
        let payload;

        if (isTTS) {
            // --- Configuración para Text-to-Speech (TTS) ---
            
            const selectedVoice = voiceName || "Kore"; // Voz por defecto
            
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;
            
            payload = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: selectedVoice }
                        }
                    }
                },
            };

        } else {
            // --- Configuración para Generación de Texto con Grounding ---

            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

            payload = {
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ "google_search": {} }], // Habilitar Google Search grounding
                systemInstruction: {
                    parts: [{ text: systemInstruction || "Actúa como un Agente de IA. Proporciona una respuesta concisa y profesional." }]
                },
            };
        }

        // 1. Llamada a la API de Gemini (con lógica de reintento)
        let geminiResponse;
        const MAX_RETRIES = 3;
        let delay = 1000;

        for (let i = 0; i < MAX_RETRIES; i++) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 429) { // Límite de cuota (Rate Limit)
                    if (i < MAX_RETRIES - 1) {
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2; // Espera exponencial
                        continue;
                    } else {
                        throw new Error('Límite de cuota excedido después de varios reintentos.');
                    }
                }

                geminiResponse = await response.json();

                if (!response.ok) {
                    // Manejar errores de la API (ej: clave inválida, error del modelo)
                    const errorDetails = geminiResponse.error || geminiResponse;
                    res.status(response.status).json({ 
                        error: isTTS ? 'Error al generar TTS' : 'Error al generar texto', 
                        details: errorDetails 
                    });
                    return;
                }
                
                // Si todo sale bien, salimos del bucle
                break; 

            } catch (error) {
                if (i < MAX_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; 
                    continue;
                } else {
                    throw error;
                }
            }
        }
        
        // 2. Procesar y devolver la respuesta
        if (isTTS) {
            // --- Devolver respuesta TTS ---
            const audioPart = geminiResponse.candidates?.[0]?.content?.parts?.[0];
            const audioData = audioPart?.inlineData?.data;
            const mimeType = audioPart?.inlineData?.mimeType;

            if (audioData && mimeType) {
                // El cliente espera estos campos: audioData y mimeType
                res.status(200).json({ audioData, mimeType });
            } else {
                res.status(500).json({ error: 'Respuesta TTS incompleta o vacía.', details: geminiResponse });
            }
        } else {
            // --- Devolver respuesta de Texto ---
            // El cliente espera la respuesta estándar del modelo de texto
            res.status(200).json(geminiResponse);
        }

    } catch (error) {
        console.error('Error interno del proxy:', error);
        res.status(500).json({ error: 'Error interno del servidor proxy.', details: error.message });
    }
};