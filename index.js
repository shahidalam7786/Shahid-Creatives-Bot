const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// In-Memory Session Storage
const userSessions = {};

// Meta Webhook Verification
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

// Main Webhook Logic
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
                    const rawText = message.text.body;
                    const userText = rawText.trim().toLowerCase();
                    console.log(`Incoming message from ${from}: ${userText.substring(0, 50)}...`);

                    // =========================================================
                    // 🔥 NEW UPGRADE: WEBSITE LEAD AUTO-DETECTION & CRM SYNC
                    // =========================================================
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate")) {
                        
                        // 1. Data Parsing Logic (Extracting details from your exact template layout)
                        let clientName = "Valued Client";
                        let projectScope = "Website Custom Estimate";
                        let estimatedValue = "8713"; // Default starter price fallback

                        try {
                            const nameMatch = rawText.match(/Client Name:\s*(.*)/i);
                            const scopeMatch = rawText.match(/Category Model:\s*(.*)/i);
                            const priceMatch = rawText.match(/Total Due \(incl\. GST\):\s*₹\s*([\d,]+)/i);

                            if (nameMatch) clientName = nameMatch[1].trim();
                            if (scopeMatch) projectScope = "Website: " + scopeMatch[1].trim();
                            if (priceMatch) estimatedValue = priceMatch[1].replace(/,/g, '').trim();
                        } catch (parseError) {
                            console.error("Data extraction parsing failed:", parseError.message);
                        }

                        // 2. 🚀 Send data to your Custom Website Admin Dashboard Database API
                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: clientName,
                                whatsapp_number: from,
                                project_scope: projectScope,
                                value: estimatedValue
                            });
                            console.log(`🚀 [SUCCESS] Lead data synced with Shahid Creatives Admin Dashboard for ${clientName}`);
                        } catch (apiError) {
                            console.error("❌ [API ERROR] Dashboard DB Sync Failed:", apiError.message);
                        }

                        // 3. 🌟 Send Instant Real-time Alert to your Personal WhatsApp Number
                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client Phone:* +${from}\n👤 *Client Name:* ${clientName}\n📝 *Plan Selected:* ${projectScope}\n💰 *Total Value:* ₹${estimatedValue}\n\n🤖 *Status:* Bot has engaged the client. Data successfully injected into Leads Control Log!`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        // 4. Send a VIP conversion-focused welcome message to the client on the bot chat
                        let clientReply = `Thank you *${clientName}*! 🙏 Aapka cost estimation data hamare production server par secure ho gaya hai.\n\nShahid bhai tak aapki saari specifications aur roadmap preferences pahunch chuki hain.\n\n🚀 Kya aap is project ka **Token Booking (₹999)** karke apna development slot instantly lock karna chahte hain, ya direct details discuss karna chahte hain?\n\nNiche diye gaye number se reply kijiye:\n\n1️⃣ **Token Book Karein (Slot Confirm)**\n2️⃣ **Discuss Requirements (Strategy Call)**`;
                        
                        // Reset session step for future navigation
                        userSessions[from] = { step: 'main_menu' }; 
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    // Initialize User Session if not exists
                    if (!userSessions[from]) {
                        userSessions[from] = { step: 'welcome' };
                    }

                    let replyText = "";
                    const currentStep = userSessions[from].step;

                    // =========================================================
                    // 2. REGULAR INBOUND BOT LEAD CAPTURE FLOW (From WhatsApp directly)
                    // =========================================================
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = rawText;
                        userSessions[from].step = 'ask_name_email';
                        
                        replyText = "Awesome! 📝 Mujhe aapke project ki thodi details mil gayi hain.\n\nKindly apna **Full Name** aur **Email ID** bhej lijiye taaki main aapka lead profile update kar sakoon.";
                        return sendWhatsAppMessage(from, replyText);
                    }

                    if (currentStep === 'ask_name_email') {
                        const contactDetails = rawText;
                        userSessions[from].step = 'completed';

                        replyText = `Thank you, details receive ho gayi hain! 🤝\n\nMaine aapka requirement dashboard par update kar diya hai. Shahid personally aapke requirements ko review kar rahe hain.\n\nHumne aapke liye ek **Direct Booking Gateway Link** activate kiya hai jahan se aap apna slot instant lock kar sakte hain:\n\n🔗 *Book/Pay Here:* https://shahidcreatives.com\n\n💡 Aap website par ja kar apna favorite plan select kar sakte hain, add-ons jodd sakte hain, aur **Token Booking (₹999)** se instant project entry karwa sakte hain! 🚀`;
                        
                        // WhatsApp directly aayi lead ko bhi Website CRM dashboard par push karein
                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: contactDetails.split(',')[0] || contactDetails,
                                whatsapp_number: from,
                                project_scope: userSessions[from].projectScope,
                                value: "8713" 
                            });
                        } catch (dbErr) { console.log("Direct bot lead dashboard sync skipped/failed"); }

                        // Notify Shahid Bhai on Personal Number
                        const adminNotification = `🌟 *NEW CHATBOT LEAD CAPTURED!* 🌟\n\n📱 *Client Phone:* +${from}\n📝 *Project Scope:* ${userSessions[from].projectScope}\n👤 *Contact Details:* ${contactDetails}`;
                        await sendWhatsAppMessage("917529839762", adminNotification); 

                        return sendWhatsAppMessage(from, replyText);
                    }

                    // =========================================================
                    // 3. MAIN CHATBOT NAVIGATION MENU
                    // =========================================================
                    if (userText === 'hi' || userText === 'hello' || userText === 'menu' || userText === 'start' || userText === '2') {
                        userSessions[from].step = 'main_menu';
                        replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nHigh-performance web sales engines & AI automation systems banane mein hum global clients ki help karte hain.\n\nAapko kis service ke baare mein jaanna hai? Niche diya gaya number reply mein bhejien:\n\n1️⃣ **Web Development Tiers** (Custom Sites/E-commerce)\n2️⃣ **AI Business Automation** (Custom WhatsApp Bots/CRM Workflows)\n3️⃣ **🔥 Exclusive Launch Deal** (Flat 20% OFF)\n4️⃣ **💳 Direct Booking & Token System** (₹999 Slot Lock)\n5️⃣ **👤 Talk to Shahid** (Direct Consultation)";
                    } 
                    else if (userText === '1') {
                        replyText = "💻 *Shahid Creatives - Web Development Tiers:*\n\n• 📄 *Starter Site* (₹8,713)\n• 💼 *Basic Small Business* (₹12,300)\n• 🌟 *Starter Business Hub* (₹25,500) *(Best Choice)*\n• 🛒 *E-commerce Hub* (₹47,500)\n• 🚀 *Custom SaaS App* (₹1,45,000+)\n\n👉 Apna **Project Scope / Requirement** niche reply kijiye (e.g. 'Gym website banwani hai') taaki hum aage badhein.";
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '3') {
                        replyText = "🔥 *Exclusive Launch Offer!* 🔥\n\nHamare advanced plans par is waqt **Flat 20% Discount** active hai. Website checkout par coupon code **LAUNCH20** use kijiye!\n\n👉 Is discount ko secure karne ke liye niche apna **Name aur Project Type** likh kar bhejien.";
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '4') {
                        replyText = "💳 *Direct Project Booking System:*\n\nAap hamare portal par ja kar sirf **₹999 (Token Booking)** dekar apna slot instantly lock kar sakte hain taaki hum kaam shuru kar sakein!\n\n🔗 **Direct Gateway Link:** https://shahidcreatives.com";
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '5') {
                        replyText = "👤 *Direct Consultation with Shahid:*\n\nShahid personally aapke design layout aur core architecture par connect karenge.\n\n👉 Kindly niche apna **Name aur Contact Email** bhej dijiye.";
                        userSessions[from].step = 'collect_details';
                    } 
                    else {
                        replyText = "Main samajh nahi paya. 🤔 Dobara main menu dekhne ke liye ek baar *'Hi'* ya *'Hello'* bhejien!";
                    }

                    await sendWhatsAppMessage(from, replyText);
                }
            }
        } catch (error) {
            console.error("Error handling WhatsApp Webhook:", error.message);
        }
    }
});

// Helper Function for Meta Message API
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
