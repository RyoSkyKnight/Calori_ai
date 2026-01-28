// api/analyze.js
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { imageBase64 } = req.body;

        // Validasi API key
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({
                error: 'API key not configured on server'
            });
        }

        // Validasi input
        if (!imageBase64) {
            return res.status(400).json({
                error: 'Image data is required'
            });
        }

        // Request ke Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Analyze this food image in Indonesian language and provide detailed nutritional information. Include:

1. 🍽️ Identifikasi Makanan (nama makanan yang terdeteksi)
2. 🔥 Estimasi Kalori (dalam kkal)
3. 📊 Makronutrien:
   - Protein (gram)
   - Karbohidrat (gram)
   - Lemak (gram)
4. 📏 Estimasi Porsi (dalam gram atau ml)
5. 💡 Tips Kesehatan atau catatan penting
6. ⚖️ Rekomendasi: Apakah makanan ini cocok untuk diet? (Ya/Tidak dan alasannya)

Berikan jawaban yang spesifik dengan angka yang akurat. Format jawaban dengan rapi dan mudah dibaca.`
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.7,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Groq API error:', errorData);
            return res.status(response.status).json({
                error: errorData.error?.message || 'Failed to analyze image'
            });
        }

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content;

        if (!result) {
            return res.status(500).json({
                error: 'No response from AI'
            });
        }

        return res.status(200).json({
            success: true,
            result: result
        });

    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({
            error: error.message || 'Internal server error'
        });
    }
}