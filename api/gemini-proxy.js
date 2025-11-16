/**
 * Vercel Serverless Function para llamar de forma segura a la API de Gemini.
 * Esta función lee la clave API de las variables de entorno (GEMINI_API_KEY)
 * y reenvía la solicitud del cliente a la API de Google, 
 * manteniendo la clave sensible oculta del frontend.
 */

// Importante: La GEMINI_API_KEY DEBE estar configurada en tus variables de entorno.
const API_KEY = process.env.GEMINI_API_KEY;
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent';

// Handler principal para la función serverless.
export default async function handler(req, res) {
    // 1. Verificar la Clave API
    if (!API_KEY) {
        return res.status(500).json({ 
            error: 'GEMINI_API_KEY no está configurada en las variables de entorno.',
            details: 'Por favor, configura GEMINI_API_KEY en tu plataforma de despliegue (ej. Vercel).'
        });
    }

    // 2. Verificar el método POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido. Solo se soporta POST.' });
    }

    try {
        // 3. Analizar el cuerpo JSON enviado desde el cliente
        const { prompt, systemInstruction } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Falta el campo "prompt" en el cuerpo de la solicitud.' });
        }

        // Construir el payload completo para la API de Gemini
        const geminiPayload = {
            contents: [{ parts: [{ text: prompt }] }],
            // Habilitar Google Search grounding para datos en tiempo real
            tools: [{ "google_search": {} }], 
        };

        // Agregar la instrucción del sistema si se proporciona
        if (systemInstruction) {
             geminiPayload.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        // 4. Llamar a la API de Gemini usando la clave segura
        const apiResponse = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(geminiPayload)
        });

        const result = await apiResponse.json();

        if (!apiResponse.ok) {
            // Reenviar errores de la API de Gemini
            console.error('Error de la API de Gemini:', result);
            return res.status(apiResponse.status).json({ error: 'Error de API Externa', details: result });
        }

        // 5. Enviar la respuesta exitosa de vuelta al cliente
        res.status(200).json(result);

    } catch (error) {
        console.error('Error de Proxy:', error);
        res.status(500).json({ error: 'Error interno del servidor durante la llamada a la API.', details: error.message });
    }
}