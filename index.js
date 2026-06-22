const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Meta Developer Dashboard ke liye Verification Webhook
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "shahid_creatives_secret_token_123"; // Aapka verify token
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// WhatsApp Messages Handle Karne Ke Liye Post Webhook
app.post('/webhook', async (req, res) => {
    res.sendStatus(200); // Meta ko turant response bhejein

    const body = req.body;

    if (body.object === 'whatsapp_business_account' && body.entry) {
        try {
            const entry = body.entry[0];
            const changes = entry.changes[0];
            const value = changes.value;

            if (value.messages) {
                const message = value.messages[0];
                const from = message.from; // Customer ka number
                const msgType = message.type;

                // Agar customer ne Text message bheja hai
                if (msgType === 'text') {
                    const userText = message.text.body.trim().toLowerCase();
                    console.log(`Received message from ${from}: ${userText}`);

                    // Chatbot Logic
                    let replyText = "Welcome to *Shahid Creatives*! 🙏 Aapke message ke liye shukriya. Hum jald hi aap se sampark karenge.";

                    if (userText === 'hi' || userText === 'hello') {
                        replyText = "Hello! *Shahid Creatives* mein aapka swagat hai. ❤️\n\nAapko kis tarah ki service chahiye?\n1. Video Editing\n2. Graphic Design\n3. Price Inquiry\n\nKripya 1, 2 ya 3 likh kar reply karein.";
                    } else if (userText === '1') {
                        replyText = "🎥 *Video Editing Services:*\nHum Cinematic Videos, Reels, aur YouTube content edit karte hain. Aapko kis type ki editing chahiye?";
                    } else if (userText === '2') {
                        replyText = "🎨 *Graphic Design Services:*\nHum Thumbnails, Posters, aur Brand Logos design karte hain.";
                    } else if (userText === '3') {
                        replyText = "💰 *Pricing Details:*\nHamare charges service ke hisab se alag-alag hain. Hamari basic marketplace strategy ₹299 se shuru hoti hai. Aapko detailed quotation jald hi bhej di jayegi.";
                    }

                    // Meta API ke zariye reply bhejna
                    const WHATSAPP_TOKEN = "const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
                    const PHONE_NUMBER_ID = "1202984902891472";

                    await axios({
                        method: "POST",
                        url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
                        data: {
                            messaging_product: "whatsapp",
                            to: from,
                            type: "text",
                            text: { body: replyText }
                        },
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${WHATSAPP_TOKEN}`
                        }
                    });
                }
            }
        } catch (error) {
            console.error("Error handling WhatsApp Webhook:", error.message);
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Google Cloud Server is running successfully on port ${PORT}`);
});
