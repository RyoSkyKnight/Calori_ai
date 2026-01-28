require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// MIME types
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API endpoint untuk analisis gambar
    if (req.url === '/api/analyze' && req.method === 'POST') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            try {
                const { imageBase64 } = JSON.parse(body);

                // Validasi API key
                if (!process.env.GROQ_API_KEY) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'API key not configured on server'
                    }));
                    return;
                }

                // Validasi input
                if (!imageBase64) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'Image data is required'
                    }));
                    return;
                }

                // Request ke Groq API menggunakan fetch
                const fetch = (await import('node-fetch')).default;
                
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
                    res.writeHead(response.status, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: errorData.error?.message || 'Failed to analyze image'
                    }));
                    return;
                }

                const data = await response.json();

                // Extract the response content
                const result = data.choices?.[0]?.message?.content;

                if (!result) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        error: 'No response from AI'
                    }));
                    return;
                }

                // Send successful response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    result: result
                }));

            } catch (error) {
                console.error('Server error:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    error: error.message || 'Internal server error'
                }));
            }
        });
        return;
    }

    // Serve static files dari folder public
    let filePath = './public' + req.url;
    if (filePath === './public/') {
        filePath = './public/index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/`);
    console.log(`📁 Serving files from ./public directory`);
    console.log(`🔑 API Key configured: ${process.env.GROQ_API_KEY ? 'Yes ✓' : 'No ✗'}`);
});