const express = require('express');
const router = express.Router();
const multer = require('multer');
const vision = require('@google-cloud/vision');

// Configure multer for image upload
const upload = multer({ storage: multer.memoryStorage() });

// Initialize Google Cloud Vision
const client = new vision.ImageAnnotatorClient({
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// ============================================================
// AI IMAGE ORDERING
// ============================================================
router.post('/ai-image', upload.single('image'), async (req, res) => {
    try {
        const imageBuffer = req.file.buffer;

        // Send image to Google Vision for text detection
        const [result] = await client.textDetection({
            image: { content: imageBuffer.toString('base64') }
        });

        const detections = result.textAnnotations;
        if (!detections || detections.length === 0) {
            return res.json({ 
                success: false, 
                error: 'No text detected in image' 
            });
        }

        // Parse the extracted text
        const text = detections[0].description;
        const products = parseShoppingList(text);

        res.json({ 
            success: true, 
            products: products,
            rawText: text
        });

    } catch (error) {
        console.error('AI image processing error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ============================================================
// PARSE SHOPPING LIST
// ============================================================
function parseShoppingList(text) {
    const lines = text.split('\n');
    const products = [];

    lines.forEach(line => {
        // Match patterns like "2 Indomie" or "Indomie 2"
        const match = line.match(/(\d+)\s*(.+)/);
        if (match) {
            products.push({
                name: match[2].trim(),
                quantity: parseInt(match[1])
            });
        }
    });

    return products;
}

module.exports = router;