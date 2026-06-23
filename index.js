const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// In-Memory Session Storage to track lead steps
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

// Main Webhook Logic for Handling Messages
app.post('/webhook', async (req, res) => {
    res.sendStatus(200); // Meta ko instant acknowledgement send karein
    const body = req.body;

    if (body.object === 'whatsapp_business_account' && body.entry) {
        try {
            const entry = body.entry[0];
            const changes = entry.changes[0];
            const value = changes.value;

            if (value.messages) {
                const message = value.messages[0];
                const from = message.from; // Customer ka dynamic WhatsApp number
                const msgType = message.type;

                if (msgType === 'text') {
                    const userText = message.text.body.trim().toLowerCase();
                    console.log(`Message from ${from}: ${userText}`);

                    // Agar user ka session pehle se nahi hai toh create karein
                    if (!userSessions[from]) {
                        userSessions[from] = { step: 'welcome' };
                    }

                    let replyText = "";
                    const currentStep = userSessions[from].step;

                    // =========================================================
                    // 1. LEAD CAPTURE FLOW (State Management)
                    // =========================================================
                    
                    // Step A: Jab user project scope bataye, tab Name/Email maangein
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = message.text.body;
                        userSessions[from].step = 'ask_name_email';
                        
                        replyText = "Awesome! 📝 Mujhe aapke project ki thodi details mil gayi hain.\n\nKindly apna **Full Name** aur **Email ID** bhej lijiye taaki main aapka lead profile update kar sakoon.";
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // Step B: Jab user Name/Email de, tab flow complete karein aur Admin ko alert bhejen
                    if (currentStep === 'ask_name_email') {
                        const contactDetails = message.text.body;
                        userSessions[from].step = 'completed';

                        // Client ke liye reply text
                        replyText = `Thank you, details receive ho gayi hain! 🤝\n\nMaine aapka requirement dashboard par update kar diya hai. Shahid personally aapke requirements ko review kar rahe hain.\n\nHumne aapke liye ek **Direct Booking Gateway Link** activate kiya hai jahan se aap apna slot instant lock kar sakte hain:\n\n🔗 *Book/Pay Here:* https://shahidcreatives.com\n\n💡 Aap website par ja kar apna favorite plan select kar sakte hain, add-ons jodd sakte hain, aur **Token Booking (₹999)** se instant project entry karwa sakte hain! 🚀`;
                        
                        // 1. Render Dashboard Logs mein print karein
                        console.log(`=== NEW LEAD CAPTURED ===\nPhone: ${from}\nScope: ${userSessions[from].projectScope}\nContact: ${contactDetails}\n=========================`);
                        
                        // 2. 🌟 Shahid Bhai ke Personal WhatsApp par Lead Alert Automatic Forward karein
                        const adminNotification = `🌟 *NEW LEAD CAPTURED!* 🌟\n\n📱 *Client Phone:* +${from}\n📝 *Project Scope:* ${userSessions[from].projectScope}\n👤 *Contact Details:* ${contactDetails}`;
                        await sendWhatsAppMessage("917529839762", adminNotification); 

                        // Client ko final link bhejien
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // =========================================================
                    // 2. MAIN CHATBOT NAVIGATION (Menu Rules)
                    // =========================================================
                    if (userText === 'hi' || userText === 'hello' || userText === 'menu' || userText === 'start') {
                        userSessions[from].step = 'main_menu';
                        replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, India). 🚀\nHigh-performance web sales engines & AI automation systems banane mein hum global clients ki help karte hain.\n\nAapko kis service ke baare mein jaanna hai? Niche diya gaya number reply mein bhejien:\n\n1️⃣ **Web Development Tiers** (Custom Sites/E-commerce)\n2️⃣ **AI Business Automation** (Custom WhatsApp Bots/CRM Workflows)\n3️⃣ **🔥 Exclusive Launch Deal** (Flat 20% OFF)\n4️⃣ **💳 Direct Booking & Token System** (₹999 Slot Lock)\n5️⃣ **👤 Talk to Shahid** (Direct Consultation)";
                    } 
                    
                    // Option 1: Web Development Tiers
                    else if (userText === '1' || userText.includes('web') || userText.includes('website')) {
                        replyText = "💻 *Shahid Creatives - Web Development Tiers:*\n\n" +
                                    "• 📄 *Starter Site* (₹8,713) - Small local businesses ke liye best.\n" +
                                    "• 💼 *Basic Small Business* (₹12,300) - For CAs, Doctors, and Freelancers.\n" +
                                    "• 🌟 *Starter Business Hub* (₹25,500) - 1-Yr Free Domain & Hosting included! *(Most Popular)*\n" +
                                    "• 🛒 *E-commerce Hub* (₹47,500) - Full Online Store + UPI Gateway + Automated Orders Alert.\n" +
                                    "• 🚀 *Custom SaaS/Enterprise App* (₹1,45,000+) - Advanced ERPs and secure portals.\n\n" +
                                    "💡 *Raat ke 2 baje wali logic:* Sir, aap so jayenge par aapka website system 24/7 chalega, customer secure karega aur payments capture karega!\n\n" +
                                    "👉 Apna **Project Scope / Requirement** niche reply kijiye (e.g. 'Mujhe online cloth store banana hai') taaki hum aage badhein.";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // Option 2: AI Automation
                    else if (userText === '2' || userText.includes('automation') || userText.includes('bot')) {
                        replyText = "🤖 *AI Business Automation:* \n\nHum custom WhatsApp chatbots, business lead funnels aur automatic CRM integration workflows design karte hain jo aapki team ka daily **4+ hours** bacha sakta hai.\n\n👉 Apne business ke liye requirement share karne ke liye niche apna **Business Type** reply kijiye!";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // Option 3: Launch Deal
                    else if (userText === '3' || userText.includes('deal') || userText.includes('offer')) {
                        replyText = "🔥 *Exclusive Launch Offer!* 🔥\n\nHamare advanced plans par is waqt **Flat 20% Discount** active hai. \n\nWebsite checkout par coupon code **LAUNCH20** use kijiye aur flat discount paiye! Yeh sirf pehle 5 visionary brands ke liye valid hai.\n\n👉 Is discount ko secure karne ke liye niche apna **Name aur Project Type** likh kar bhejien.";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // Option 4: Direct Booking & Token System
                    else if (userText === '4' || userText.includes('booking') || userText.includes('pay') || userText.includes('token')) {
                        replyText = "💳 *Direct Project Booking System:*\n\nAapko lambe verification ya wait karne ki koi zaroorat nahi hai. Aap hamare portal par ja kar:\n\n1. Apna custom package select kar sakte hain.\n2. Alag se features (SEO, Maintenance, Cloud Hosting) add kar sakte hain.\n3. Sirf **₹999 (Token Booking)** dekar apna slot instantly lock kar sakte hain taaki hum kaam shuru kar sakein!\n\n🔗 **Direct Gateway Link:** https://shahidcreatives.com\n\n👉 Agar aapne payment kar di hai ya koi issue aa raha hai, toh apna naam niche bhejien!";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // Option 5: Direct Support
                    else if (userText === '5' || userText.includes('shahid') || userText.includes('consultation')) {
                        replyText = "👤 *Direct Consultation with Shahid:*\n\nAapka session request forward kiya ja raha hai. Shahid personally aapke design layout aur core architecture par connect karenge.\n\n👉 Kindly niche apna **Name, Business Name aur Contact Email** bhej dijiye.";
                        userSessions[from].step = 'collect_details';
                    } 
                    
                    // Fallback Default Reply
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
