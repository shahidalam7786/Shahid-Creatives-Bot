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

                    // 🌍 LANGUAGE ROUTING LOGIC
                    const isInternationalNumber = !from.startsWith("91");
                    const isGlobalWebsiteTemplate = rawText.includes("Global USD") || rawText.includes("Worldwide");
                    
                    if (!userSessions[from]) {
                        userSessions[from] = { 
                            step: 'welcome',
                            lang: (isInternationalNumber || isGlobalWebsiteTemplate) ? 'EN' : 'HINGLISH',
                            clientName: "Valued Client",
                            projectScope: "Custom Project Development"
                        };
                    }
                    
                    const userLang = userSessions[from].lang;

                    // =========================================================
                    // 1. WEBSITE LEAD AUTO-DETECTION & CRM SYNC
                    // =========================================================
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate")) {
                        
                        let clientName = "Valued Client";
                        let projectScope = "Website Custom Estimate";
                        let estimatedValue = "8713"; 

                        try {
                            const nameMatch = rawText.match(/Client Name:\s*(.*)/i);
                            const scopeMatch = rawText.match(/Category Model:\s*(.*)/i);
                            const priceMatch = rawText.match(/Total Due \(incl\. GST\):\s*[\?₹\$]\s*([\d,]+)/i);

                            if (nameMatch) clientName = nameMatch[1].trim();
                            if (scopeMatch) projectScope = scopeMatch[1].trim();
                            if (priceMatch) estimatedValue = priceMatch[1].replace(/,/g, '').trim();
                        } catch (parseError) {
                            console.error("Data extraction parsing failed:", parseError.message);
                        }

                        // Session memory upgrade
                        userSessions[from].clientName = clientName;
                        userSessions[from].projectScope = projectScope;

                        // Sync to Website Admin Dashboard API
                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: clientName,
                                whatsapp_number: from,
                                project_scope: "Website: " + projectScope,
                                value: estimatedValue
                            });
                        } catch (apiError) {
                            console.error("Dashboard DB Sync Failed:", apiError.message);
                        }

                        // Send Alert to Shahid Bhai's Personal Number
                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* +${from}\n👤 *Name:* ${clientName}\n📝 *Plan:* ${projectScope}\n💰 *Value:* ${userLang === 'EN' ? '$' : '₹'}${estimatedValue}\n\n🤖 *Status:* Handled in ${userLang === 'EN' ? 'English' : 'Hinglish'} mode. Hooked to CRM!`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        // Dynamic Reply
                        let clientReply = "";
                        if (userLang === 'EN') {
                            clientReply = `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved on our production server.\n\nShahid has received your project specifications and technical preferences.\n\n🚀 Would you like to confirm your deployment slot with a **Token Booking ($49)** or schedule a strategy kickoff call right away?\n\nPlease reply with the number of your choice:\n\n1️⃣ **Book Token (Confirm Slot)**\n2️⃣ **Discuss Requirements (Schedule Strategy Call)**`;
                        } else {
                            clientReply = `Thank you *${clientName}*! 🙏 Aapka cost estimation data hamare production server par secure ho gaya hai.\n\nShahid bhai tak aapki saari specifications pahunch chuki hain.\n\n🚀 Kya aap is project ka **Token Booking (₹999)** karke apna slot instantly lock karna chahte hain, ya direct details discuss karna chahte hain?\n\nNiche diye gaye number se reply kijiye:\n\n1️⃣ **Token Book Karein (Slot Confirm)**\n2️⃣ **Discuss Requirements (Strategy Call)**`;
                        }
                        
                        userSessions[from].step = 'awaiting_website_action'; 
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    let replyText = "";
                    const currentStep = userSessions[from].step;

                    // =========================================================
                    // ⚙️ HANDLING ACTION AFTER WEBSITE REDIRECT
                    // =========================================================
                    if (currentStep === 'awaiting_website_action') {
                        if (userText === '1') {
                            userSessions[from].step = 'main_menu'; 

                            // Generate Dynamic Parameters according to your architecture layout
                            const uniqueProjectId = `SC-${Date.now().toString().slice(-6)}`; 
                            const encodedName = encodeURIComponent(userSessions[from].clientName);
                            const encodedPlan = encodeURIComponent(userSessions[from].projectScope);
                            
                            if (userLang === 'EN') {
                                const tokenAmountUSD = "49";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&phone=${from}&plan=${encodedPlan}`;
                                
                                replyText = `領 *Excellent Choice!* I have generated your dynamic project invoice portal.\n\nClick the official checkout gateway link below to pay the **Token Booking fee ($49)** via Razorpay and instantly lock your deployment timeline in Firestore:\n\n🔗 *Pay Securely Here:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}\n\nOnce authorized, your infrastructure onboarding begins! 🚀`;
                            } else {
                                const tokenAmountINR = "999";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&phone=${from}&plan=${encodedPlan}`;
                                
                                replyText = `💳 *Zabardast Choice!* Maine aapka dynamic client booking invoice link generate kar diya hai.\n\nNiche diye gaye official gateway par click karke apna **Token Booking (₹999)** secure karein. Yeh details auto-fill hokar Firestore Dashboard par 'Slot-Locked' save ho jayengi:\n\n🔗 *Pay Securely Here:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}\n\nPayment successfully complete hote hi aapka system onboarding kickoff ho jayega! 🚀`;
                            }
                            return sendWhatsAppMessage(from, replyText);
                        } 
                        else if (userText === '2') {
                            userSessions[from].step = 'main_menu';
                            replyText = (userLang === 'EN')
                                ? "👤 Perfect! Shahid will connect with you shortly for a strategy sync call to freeze the specifications. Get ready to launch!"
                                : "👤 Perfect! Shahid bhai bohot jald aapke sath strategy call par connect karenge taaki specifications ko finalize kiya ja sake. Get ready to launch! 🚀";
                            return sendWhatsAppMessage(from, replyText);
                        }
                    }

                    // =========================================================
                    // 2. 🌟 SELF LEAD CAPTURE FLOW (WHEN USER CHATS DIRECTLY WITH BOT)
                    // =========================================================
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = rawText; // User types requirement
                        userSessions[from].step = 'ask_name_email';
                        
                        replyText = (userLang === 'EN') 
                            ? "Awesome! 📝 I have received your initial project ideas.\n\nKindly reply with your **Full Name** and **Email Address** so I can update your client profile."
                            : "Awesome! 📝 Mujhe aapke project ki thodi details mil gayi hain.\n\nKindly apna **Full Name** aur **Email ID** bhej lijiye taaki main aapka lead profile update kar sakoon.";
                        return sendWhatsAppMessage(from, replyText);
                    }

                    if (currentStep === 'ask_name_email') {
                        const contactDetails = rawText;
                        userSessions[from].step = 'completed';

                        // Parsing clean name from incoming string
                        const cleanName = contactDetails.split(',')[0] || contactDetails;
                        userSessions[from].clientName = cleanName;

                        // Sync to CRM Dashboard ledger
                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: cleanName,
                                whatsapp_number: from,
                                project_scope: "ChatBot: " + userSessions[from].projectScope,
                                value: (userLang === 'EN') ? "299" : "8713"
                            });
                        } catch (dbErr) { console.log("Dashboard sync failed"); }

                        // Notify Shahid Bhai
                        const adminNotification = `🌟 *NEW DIRECT CHAT LEAD CAPTURED!* 🌟\n\n📱 *Phone:* +${from}\n📝 *Scope:* ${userSessions[from].projectScope}\n👤 *Contact:* ${contactDetails}\n🌍 *Mode:* ${userLang}`;
                        await sendWhatsAppMessage("917529839762", adminNotification); 

                        // 🌟 MAGIC TRIGGER: Generating Instant Direct Token Link inside Chat Bot directly!
                        const uniqueProjectId = `SC-${Date.now().toString().slice(-6)}`;
                        const encodedName = encodeURIComponent(cleanName);
                        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);
                        
                        if (userLang === 'EN') {
                            const tokenAmountUSD = "49";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&phone=${from}&plan=${encodedPlan}`;
                            
                            replyText = `Thank you, your profile has been secured! 🤝\n\nI have generated a **Direct Token Gateway Link** using your captured chat session parameters.\n\nYou can instantly pay the booking fee ($49) to lock this timeline in Firestore and route your profile to active production:\n\n🔗 *Pay Securely Here:* ${selfPayLink}\n\n*Reference ID:* ${uniqueProjectId}`;
                        } else {
                            const tokenAmountINR = "999";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&phone=${from}&plan=${encodedPlan}`;
                            
                            replyText = `Thank you, aapki details receive ho gayi hain! 🤝\n\nMaine aapke chat data ke aadhar par aapka **Direct Token Payment Link** generate kar diya hai.\n\nAap niche diye gaye secure path par click karke direct Razorpay se **₹999 Token Booking** complete kar sakte hain. Isse Firestore mein aapka slot automatic book ho jayega:\n\n🔗 *Direct Pay Gateway Link:* ${selfPayLink}\n\n*Project Reference ID:* ${uniqueProjectId}\n\n💡 Agar aap pehle details discuss karna chahte hain, toh bejhijhak yahan apna message type kijiye!`;
                        }

                        return sendWhatsAppMessage(from, replyText);
                    }

                    // =========================================================
                    // 3. MAIN CHATBOT NAVIGATION MENU
                    // =========================================================
                    if (userText === 'hi' || userText === 'hello' || userText === 'menu' || userText === 'start') {
                        userSessions[from].step = 'main_menu';
                        
                        if (userLang === 'EN') {
                            replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nWe engineer high-performance web applications and design custom AI automation hubs for global brands.\n\nHow can we accelerate your business? Please reply with a number:\n\n1️⃣ **Web Development Tiers** (Custom Sites/SaaS/E-commerce)\n2️⃣ **AI Business Automation** (Custom WhatsApp Bots/CRM Workflows)\n3️⃣ **🔥 Exclusive Launch Deal** (Flat 20% OFF)\n4️⃣ **💳 Direct Booking & Token System** ($49 Slot Lock)\n5️⃣ **👤 Talk to Shahid** (Direct Consultation)";
                        } else {
                            replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nHigh-performance web sales engines & AI automation systems banane mein hum global clients ki help karte hain.\n\nAapko kis service ke baare mein jaanna hai? Niche diya gaya number reply mein bhejien:\n\n1️⃣ **Web Development Tiers** (Custom Sites/E-commerce)\n2️⃣ **AI Business Automation** (Custom WhatsApp Bots/CRM Workflows)\n3️⃣ **🔥 Exclusive Launch Deal** (Flat 20% OFF)\n4️⃣ **💳 Direct Booking & Token System** (₹999 Slot Lock)\n5️⃣ **👤 Talk to Shahid** (Direct Consultation)";
                        }
                    } 
                    else if (userText === '1') {
                        if (userLang === 'EN') {
                            replyText = "💻 *Shahid Creatives - Premium Web Tiers:*\n\n• 💼 *Starter Premium Business Hub* ($299 onwards) - 1-Yr Free Domain & Premium High-Speed Cloud Hosting included!\n• 🛒 *Global E-commerce Engine* ($599) - Multi-currency Store + Stripe/PayPal Integration.\n• 🚀 *Custom SaaS / Enterprise Portal* ($1,750+) - Tailored logic, secure databases.\n\n👉 Please reply with your **Project Scope / Requirements** to proceed.";
                        } else {
                            replyText = "💻 *Shahid Creatives - Web Development Tiers:*\n\n• 📄 *Starter Site* (₹8,713)\n• 💼 *Basic Small Business* (₹12,300)\n• 🌟 *Starter Business Hub* (₹25,500) *(Best Choice)*\n• 🛒 *E-commerce Hub* (₹47,500)\n• 🚀 *Custom SaaS App* (₹1,45,000+)\n\n👉 Apna **Project Scope / Requirement** niche reply kijiye (e.g. 'Gym website banwani hai') taaki hum aage badhein.";
                        }
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '3') {
                        if (userLang === 'EN') {
                            replyText = "🔥 *Exclusive Global Launch Offer!* 🔥\n\nGet a **Flat 20% Discount** using code **LAUNCH20** at checkout.\n\n👉 Reply with your **Name and Project Goal** right now to lock in this discount!";
                        } else {
                            replyText = "🔥 *Exclusive Launch Offer!* 🔥\n\nHamare advanced plans par is waqt **Flat 20% Discount** active hai. Website checkout par coupon code **LAUNCH20** use kijiye!\n\n👉 Is discount ko secure karne ke liye niche apna **Name aur Project Type** likh kar bhejien.";
                        }
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '4') {
                        if (userLang === 'EN') {
                            replyText = "💳 *Direct Project Booking Portal:*\n\nSkip the wait time! Head straight to our portal and wire a **$49 Token Booking** to instantly secure your delivery slot.\n\n🔗 **Direct Gateway Link:** https://shahidcreatives.com";
                        } else {
                            replyText = "💳 *Direct Project Booking System:*\n\nAap hamare portal par ja kar sirf **₹999 (Token Booking)** dekar apna slot instantly lock kar sakte hain:\n\n🔗 **Direct Gateway Link:** https://shahidcreatives.com";
                        }
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '5') {
                        if (userLang === 'EN') {
                            replyText = "👤 *Direct Consultation with Shahid:*\n\nShahid will personally connect with you to evaluate your software architecture.\n\n👉 Please reply with your **Name, Business Name, and Professional Email**.";
                        } else {
                            replyText = "👤 *Direct Consultation with Shahid:*\n\nShahid personally aapke design layout aur core architecture par connect karenge.\n\n👉 Kindly niche apna **Name aur Contact Email** bhej dijiye.";
                        }
                        userSessions[from].step = 'collect_details';
                    } 
                    else {
                        replyText = (userLang === 'EN')
                            ? "I didn't quite catch that. 🤔 Please reply with *'Hi'* or *'Hello'* to view the main menu!"
                            : "Main samajh nahi paya. 🤔 Dobara main menu dekhne ke liye ek baar *'Hi'* ya *'Hello'* bhejien!";
                    }

                    await sendWhatsAppMessage(from, replyText);
                }
            }
        } catch (error) {
            console.error("Error handling WhatsApp Webhook:", error.message);
        }
    }
});

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
