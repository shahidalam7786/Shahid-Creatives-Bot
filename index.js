const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// Simple In-Memory Session Storage for Lead Tracking
const userSessions = {};

// Meta Developer Dashboard verification
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "shahid_creatives_secret_token_123";
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('WEBHOOK_VERIFIED');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// WhatsApp Messages Handle
app.post('/webhook', async (req, res) => {
    res.sendStatus(200);
    const body = req.body;

    if (body.object === 'whatsapp_business_account' && body.entry) {
        try {
            const entry = body.entry[0];
            const changes = entry.changes[0];
            const value = changes.value;

            if (value.messages) {
                const message = value.messages[0];
                const from = message.from; 
                const msgType = message.type;

                if (msgType === 'text') {
                    const userText = message.text.body.trim().toLowerCase();
                    console.log(`Received message from ${from}: ${userText}`);

                    // Initialize User Session if not exists
                    if (!userSessions[from]) {
                        userSessions[from] = { step: 'welcome' };
                    }

                    let replyText = "";
                    const currentStep = userSessions[from].step;

                    // 1. LEAD CAPTURE FLOW (If bot asked for details in previous step)
                    if (currentStep === 'collect_details') {
                        userSessions[from].details = message.text.body; // Save Scope/Details
                        userSessions[from].step = 'ask_name';
                        replyText = "Awesome! 📝 Mujhe thodi details mil gayi hain. \n\nApna **Shubh Naam (Full Name)** aur **Email ID** ek hi message mein likh kar bhej दीजिए, taaki hum agenda ready rakh sakein.";
                        return sendWhatsAppMessage(from, replyText);
                    } 
                    
                    if (currentStep === 'ask_name') {
                        const contactInfo = message.text.body;
                        userSessions[from].step = 'completed'; // Reset flow
                        replyText = `Perfect! 🤝 Main aapki saari details Shahid ko pass on kar raha hoon. \n\nHe will personally review your requirements aur aapko ek **Final Live Production Blueprint** aur call schedule share karenge shortly. \n\nThank you for reaching out to *Shahid Creatives*! 🚀`;
                        
                        // Log Lead Data to Console (Render Logs mein dikhega)
                        console.log(`=== NEW LEAD CAPTURED ===\nPhone: ${from}\nScope: ${userSessions[from].details}\nContact: ${contactInfo}\n=========================`);
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 2. CORE SALES NAVIGATION LOGIC
                    if (userText === 'hi' || userText === 'hello' || userText === 'menu' || userText === 'start') {
                        userSessions[from].step = 'main_menu';
                        replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nHigh-performance digital sales engines & AI automation hubs banane mein hum aapki help karte hain.\n\nAap apne business ke liye kya dekh rahe hain? Niche diye gaye number bhejien:\n\n1️⃣ **Web Development Tiers** (Custom Sites/E-commerce)\n2️⃣ **AI Business Automation** (WhatsApp Bots/CRM Sync)\n3️⃣ **🔥 Exclusive Launch Deal** (Flat 20% OFF)\n4️⃣ **👤 Direct Support** (Talk to Shahid)";
                    } 
                    
                    // Web Development Tiers
                    else if (userText === '1' || userText.includes('web') || userText.includes('website')) {
                        replyText = "🎬 *Shahid Creatives - Premium Web Development Tiers:*\n\n" +
                                    "• 📄 *Starter / Visiting Card Site* (₹8,713) - Small local dukaans ke liye perfect.\n" +
                                    "• 💼 *Basic Small Business* (₹12,300) - For Doctors, CAs, and Freelancers.\n" +
                                    "• 🌟 *Starter Business Site* (₹25,500) - Includes 1-Yr Free Domain & Hosting! *(Best Choice!)*\n" +
                                    "• 🛒 *E-commerce Hub* (₹47,500) - Full Store + UPI Gateway + Automated WhatsApp Alerts.\n" +
                                    "• 🚀 *Custom Enterprise/SaaS* (₹1,45,000+) - Custom logic, ERPs & Secure Portals.\n\n" +
                                    "💡 *Raat ke 2 baje wali logic:* Sir, aap so jayenge, par aapka yeh system raat ke 2 baje bhi naye clients ko catalog bhejega, qualify karega aur orders automate karega!\n\n" +
                                    "👉 Agar aap ready hain, toh reply mein apna **Expected Scope / Requirements** likh kar bhejien (e.g. 'Mujhe ek gym ki website banwani hai').";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // AI Automation
                    else if (userText === '2' || userText.includes('automation') || userText.includes('bot')) {
                        replyText = "🤖 *AI Business Automation Hub:*\n\n" +
                                    "Hum aapke business ke liye custom WhatsApp bots, conversational lead-capture funnels, aur automatic CRM sync workflows banate hain.\n\n" +
                                    "🔥 *Benefit:* Yeh aapki team ke **daily 4+ hours** ka manual work save karega aur har ek lead ko instantly follow up dega.\n\n" +
                                    "👉 Apna AI Automation requirement share karne ke liye niche apna **Business Type** aur requirement likh kar bhejien.";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // Launch Deal
                    else if (userText === '3' || userText.includes('deal') || userText.includes('offer') || userText.includes('launch20')) {
                        replyText = "🔥 *Exclusive Launch Deal!* 🔥\n\nWe are looking for our first **5 Visionary Brands** jinhe hum next level par le ja sakein. \n\nAdvanced plans par aapko milega **Flat 20% OFF** using code: *LAUNCH20*.\n\n👉 Is offer ko secure karne ke liye turant apna **Name aur Project Requirement** niche reply mein bhejien!";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // Direct Support
                    else if (userText === '4' || userText.includes('shahid') || userText.includes('support')) {
                        replyText = "👤 *Direct Support (Talk to Shahid):*\n\nAapka message seedha Shahid bhai tak forward kiya ja raha hai. Wo Ludhiana, Punjab se lead technical operations handle karte hain.\n\nApna **Name, Email aur query** niche bhejiye, wo aapko personally connect karenge.";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // Fallback Default Reply
                    else {
                        replyText = "Main samajh nahi paya. 🤔 Dobara shuru karne ke liye ek baar *'Hi'* ya *'Hello'* bhejien!";
                    }

                    await sendWhatsAppMessage(from, replyText);
                }
            }
        } catch (error) {
            console.error("Error handling WhatsApp Webhook:", error.message);
        }
    }
});

// Helper Function to Send Message via Meta API
async function sendWhatsAppMessage(to, text) {
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = "1202984902891472";

    await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        data: {
            messaging_product: "whatsapp",
            to: to,
            type: "text",
            text: { body: text }
        },
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${WHATSAPP_TOKEN}`
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Google Cloud Server is running successfully on port ${PORT}`);
});
