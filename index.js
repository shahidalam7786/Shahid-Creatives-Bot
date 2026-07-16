const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Meta Developer Dashboard verification
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "shahid_creatives_secret_token_123";

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

// WhatsApp Messages Handle
app.post('/webhook', async (req, res) => {
    res.sendStatus(200); // Meta ko turant response bhejien

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

                if (msgType === 'text') {
                    const userText = message.text.body.trim().toLowerCase();
                    console.log(`Received message from ${from}: ${userText}`);

                    // Chatbot Logic
                    let replyText = "Welcome to *Shahid Creatives*! 🙏 Aapke message ke liye shukriya.";

                    if (userText === 'hi' || userText === 'hello') {
                        replyText = "Hello! *Shahid Creatives* mein aapka swagat hai. ❤️\n\nAapko kis tarah ki service chahiye? Niche diye gaye number bhejien:\n\n1️⃣ *Video Editing*\n2️⃣ *Graphic Design*\n3️⃣ *Pricing Details*";
                    } else if (userText === '1') {
                        replyText = "🎬 *Video Editing Services:*\n\nHum Cinematic Videos, Reels, YouTube Videos aur Shorts edit karte hain. Aap apna raw data share kar sakte hain!";
                    } else if (userText === '2') {
                        replyText = "🎨 *Graphic Design Services:*\n\nHum Thumbnails, Posters, Logos aur Social Media Graphics design karte hain.";
                    } else if (userText === '3') {
                        replyText = "💰 *Pricing Details:*\n\nHamare charges service ke hisab se hain. Aap apna project detail share kijiye, hum best rate batayenge!";
                    }

                    // Render Dashboard ke Environment Variable se Token uthana (100% Secure)
                    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
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