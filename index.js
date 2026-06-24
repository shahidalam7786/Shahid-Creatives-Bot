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
                const from = message.from; 
                const msgType = message.type;

                if (msgType === 'text') {
                    const rawText = message.text.body;
                    const userText = rawText.trim().toLowerCase();
                    console.log(`Incoming message from ${from}: ${userText.substring(0, 50)}...`);

                    // 🌍 LANGUAGE ROUTING CONFIGURATION
                    const isInternationalNumber = !from.startsWith("91");
                    const isGlobalWebsiteTemplate = rawText.includes("Global USD") || rawText.includes("Worldwide") || rawText.includes("$");
                    
                    if (!userSessions[from]) {
                        userSessions[from] = { 
                            step: 'welcome',
                            lang: (isInternationalNumber || isGlobalWebsiteTemplate) ? 'EN' : 'HINGLISH',
                            clientName: "Valued Client",
                            clientEmail: "",
                            projectScope: "Custom Project Development",
                            lastSubmitedTime: 0 
                        };
                    }
                    
                    const userLang = userSessions[from].lang;

                    // =========================================================
                    // 1. WEBSITE LEAD AUTO-DETECTION & CRM SYNC (FIRST HOOK MESSAGE)
                    // =========================================================
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate")) {
                        
                        // Request Throttle Check to prevent immediate double triggers
                        if (userSessions[from].lastSubmitedTime && (Date.now() - userSessions[from].lastSubmitedTime < 5000)) {
                            console.log(`[THROTTLE INTERCEPT] Duplicate webhook trigger blocked for user: ${from}`);
                            return; 
                        }

                        userSessions[from].lastSubmitedTime = Date.now();

                        let clientName = "Valued Client";
                        let clientEmail = "";
                        let projectScope = "Website Custom Estimate";
                        let estimatedValue = "8713"; 

                        try {
                            // Robust Regex Line Parsers
                            const nameMatch = rawText.match(/(?:Client Name|👤[^:]*):\s*([^\n\r]+)/i);
                            const scopeMatch = rawText.match(/(?:Category Model|Model|Specifications[^:]*):\s*([^\n\r]+)/i);
                            const priceMatch = rawText.match(/(?:Estimated Price|Total Due[^:]*):\s*([^\n\r]+)/i);

                            if (nameMatch) {
                                clientName = nameMatch[1].split('\n')[0].split(',')[0].trim();
                            }
                            if (scopeMatch) {
                                projectScope = scopeMatch[1].replace(/[\*•\-]/g, '').trim();
                            }
                            if (priceMatch) {
                                let priceStr = priceMatch[1].trim();
                                if (priceStr.includes("$") || isGlobalWebsiteTemplate) {
                                    estimatedValue = priceStr.replace(/[^0-9]/g, '');
                                    estimatedValue = `$${estimatedValue}`;
                                } else {
                                    estimatedValue = priceStr.replace(/[^0-9]/g, '');
                                }
                            }

                            // Bulletproof Global Email Extractor 
                            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                            const emailMatch = rawText.match(globalEmailRegex);
                            if (emailMatch) {
                                clientEmail = emailMatch[1].trim();
                            }

                        } catch (parseError) {
                            console.error("Advanced template parsing engine failed:", parseError.message);
                        }

                        // Save parsed data in session memory
                        userSessions[from].clientName = clientName;
                        userSessions[from].clientEmail = clientEmail;
                        userSessions[from].projectScope = projectScope;

                        // Sync to Custom Dashboard Backend CRM
                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: clientName,
                                email: clientEmail,
                                whatsapp_number: from,
                                project_scope: "Website: " + projectScope,
                                value: estimatedValue
                            });
                        } catch (apiError) {
                            console.error("Dashboard DB Sync Failed:", apiError.message);
                        }

                        // Admin personal notification update alert
                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail || 'Not Provided'}\n📝 *Plan:* ${projectScope}\n💰 *Value:* ${estimatedValue}\n\n🤖 *Status:* Throttle locked & synced. Check Admin Panel!`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        // 🌟 UPGRADE: FIRST MESSAGE WITH 20% DISCOUNT HOOK ACTIVATED INSTANTLY
                        let clientReply = "";
                        if (userLang === 'EN') {
                            clientReply = `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved on our production server.\n\n🔥 *Exclusive Reward Activated:* We have successfully mapped the launch coupon code **LAUNCH20** with your session. This secures a **Flat 20% OFF** discount on your final project bill balance!\n\n🚀 Would you like to confirm your design deployment slot with a **Token Booking ($49)** or schedule a strategy kickoff call first?\n\nPlease reply with the number of your choice:\n\n1️⃣ **Book Token (Confirm Slot & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Schedule Strategy Call)**`;
                        } else {
                            clientReply = `Thank you *${clientName}*! 🙏 Aapka cost estimation data hamare production server par secure ho gaya hai.\n\n🔥 *Exclusive Offer Activated:* Maine aapke project profile ke sath launch coupon code **LAUNCH20** को टैग कर दिया है! Isse payment complete hone ke baad aapke main project price par **Flat 20% OFF (Discount)** apply ho jayega.\n\n🚀 Kya aap apna development slot instantly lock karke discount secure karna chahte hain, ya direct details discuss karna chahte hain?\n\nNiche diye gaye number se reply kijiye:\n\n1️⃣ **Token Book Karein (Slot Confirm & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Strategy Call)**`;
                        }
                        
                        userSessions[from].step = 'awaiting_website_action'; 
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    let replyText = "";
                    const currentStep = userSessions[from].step;

                    // =========================================================
                    // ⚙️ HANDLING ACTION: SEND TOKEN LINK ONLY WHEN CLIENT PRESSES 1
                    // =========================================================
                    if (currentStep === 'awaiting_website_action') {
                        if (userText === '1') {
                            userSessions[from].step = 'main_menu'; 

                            const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`; 
                            const encodedName = encodeURIComponent(userSessions[from].clientName);
                            const encodedEmail = encodeURIComponent(userSessions[from].clientEmail || "");
                            const encodedPlan = encodeURIComponent(userSessions[from].projectScope);
                            
                            if (userLang === 'EN') {
                                const tokenAmountUSD = "49";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                                
                                replyText = `💳 *Perfect!* I have generated your unique secure payment gateway portal.\n\nClick the official link below to complete your **Token Booking ($49)** via Razorpay. This will instantly reserve your slot in *Shahid Creatives* automated production queue:\n\n🔗 *Pay Securely Here:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}\n\nOnce authorized, your infrastructure onboarding process kicks off! 🚀`;
                            } else {
                                const tokenAmountINR = "999";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                                
                                replyText = `Zabardast Choice! 👍 Maine aapka unique secure client booking invoice link generate kar diya hai.\n\nAap niche diye gaye secure path par click karke direct Razorpay se apna **₹999 Token Booking** complete kar sakte hain. Isse *Shahid Creatives* mein aapka slot automatic book ho jayega aur development process instantly active ho jayega:\n\n🔗 *Direct Pay Gateway Link:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}\n\n💡 Note: Payment complete hote hi hamara client onboarding system kickoff message trigger kar dega! 🚀`;
                            }
                            return sendWhatsAppMessage(from, replyText);
                        } 
                        else if (userText === '2') {
                            userSessions[from].step = 'main_menu';
                            replyText = (userLang === 'EN')
                                ? "👤 Perfect! Shahid will connect with you shortly for a strategy sync call."
                                : "👤 Perfect! Shahid bhai bohot jald aapke sath strategy call par connect karenge taaki requirements ko finalize kiya ja sake. Get ready to launch! 🚀";
                            return sendWhatsAppMessage(from, replyText);
                        }
                    }

                    // =========================================================
                    // 2. INBOUND CHAT LEAD CAPTURE FLOW (B2B DIRECT FROM CHAT)
                    // =========================================================
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = rawText; 
                        userSessions[from].step = 'ask_name_email';
                        replyText = (userLang === 'EN') 
                            ? "Awesome! 📝 Kindly reply with your **Full Name** and **Email Address**."
                            : "Awesome! 📝 Kindly apna **Full Name** aur **Email ID** bhej lijiye.";
                        return sendWhatsAppMessage(from, replyText);
                    }

                    if (currentStep === 'ask_name_email') {
                        const contactDetails = rawText;
                        userSessions[from].step = 'completed';
                        
                        let cleanName = contactDetails.split('\n')[0].split(',')[0].trim();
                        let cleanEmail = "";
                        
                        const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                        const emailMatch = contactDetails.match(globalEmailRegex);
                        if (emailMatch) {
                            cleanEmail = emailMatch[1].trim();
                        }

                        userSessions[from].clientName = cleanName;
                        userSessions[from].clientEmail = cleanEmail;

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: cleanName,
                                email: cleanEmail,
                                whatsapp_number: from,
                                project_scope: "ChatBot: " + userSessions[from].projectScope,
                                value: (userLang === 'EN') ? "$299" : "8713"
                            });
                        } catch (dbErr) { console.log("Dashboard sync failed"); }

                        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                        const encodedName = encodeURIComponent(cleanName);
                        const encodedEmail = encodeURIComponent(cleanEmail);
                        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);
                        
                        if (userLang === 'EN') {
                            const tokenAmountUSD = "49";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Thank you, your profile has been secured! 🤝\n\n🔥 *Launch Discount Applied:* Your code **LAUNCH20** (Flat 20% OFF) is successfully linked.\n\n🔗 *Pay Securely Here:* ${selfPayLink}\n\n*Reference ID:* ${uniqueProjectId}`;
                        } else {
                            const tokenAmountINR = "999";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Thank you, aapki details receive ho gayi hain! 🤝\n\n🔥 *Launch Discount Applied:* Maine aapke profile ke sath **LAUNCH20** (Flat 20% OFF) active kar diya hai.\n\nAap niche diye gaye path par click karke direct Razorpay se **₹999 Token Booking** complete kar sakte hain. Isse *Shahid Creatives* mein aapka slot automatic book ho jayega:\n\n🔗 *Direct Pay Gateway Link:* ${selfPayLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                        }
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // =========================================================
                    // 3. MAIN MENU NAVIGATION
                    // =========================================================
                    if (userText === 'hi' || userText === 'hello' || userText === 'menu' || userText === 'start') {
                        userSessions[from].step = 'main_menu';
                        if (userLang === 'EN') {
                            replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nWe engineer high-performance web applications and design custom AI automation hubs for global brands.\n\nHow can we accelerate your business? Please reply with a number:\n\n1️⃣ **Web Development Tiers** (Custom Sites/SaaS/E-commerce)\n2️⃣ **AI Business Automation** (Custom WhatsApp Bots/CRM Workflows)\n3️⃣ **🔥 Exclusive Launch Deal** (Flat 20% OFF)\n4️⃣ **💳 Direct Booking & Token System** ($49 Slot Lock)\n5️⃣ **👤 Talk to Shahid** (Direct Consultation)";
                        } else {
                            replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nHigh-performance web sales engines & AI automation systems banane mein hum Global clients ki help karte hain.\n\nAapko kis service ke baare mein jaanna hai? Niche diya gaya number reply mein bhejien:\n\n1️⃣ *Web Development Tiers* (Custom Sites/E-commerce)\n2️⃣ *AI Business Automation* (Custom WhatsApp Bots/CRM Workflows)\n3️⃣ *🔥 Exclusive Launch Deal* (Flat 20% OFF)\n4️⃣ *💳 Direct Booking & Token System* (₹999 Slot Lock)\n5️⃣ *👤 Talk to Shahid* (Direct Consultation)";
                        }
                    } 
                    else if (userText === '1') {
                        if (userLang === 'EN') {
                            replyText = "💻 *Shahid Creatives - Premium Web Tiers:*\n\n• 💼 *Starter Premium Business Hub* ($299 onwards) - 1-Yr Free Domain & Premium Hosting.\n• 🛒 *Global E-commerce Engine* ($599) - Multi-currency Store + Stripe/PayPal.\n• 🚀 *Custom SaaS / Enterprise Portal* ($1,750+).\n\n👉 Please reply with your **Project Scope / Requirements** to proceed.";
                        } else {
                            replyText = "💻 *Shahid Creatives - Web Development Tiers:*\n\n• 📄 *Starter Plan* (₹8,713) - Premium portfolio/visiting card sites ke liye best.\n• 💼 *Advanced Plans* - Custom Sites/E-commerce applications ke liye.\n\n👉 Aap kis type ki website design karwana chahte hain? Niche reply kijiye!";
                        }
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '2') {
                        replyText = (userLang === 'EN')
                            ? "🤖 *AI Business Automation:*\n\nCustom WhatsApp API bots, automated CRM dashboards, and intelligent lead qualifiers can save thousands of hours instantly.\n\n👉 Reply with your business workflow requirement to proceed!"
                            : "🤖 *AI Business Automation:*\n\nCustom WhatsApp API bots, automated CRM sheets, and lead qualifiers aapke business ke hazaron ghante bacha sakte hain.\n\n👉 Apne requirement reply mein share karein!";
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '3') {
                        replyText = (userLang === 'EN')
                            ? "🔥 *Exclusive Global Launch Offer!* 🔥\n\nCongratulations! You are eligible for a **Flat 20% Discount** on all tiers.\n\n👉 Reply with your **Name and Project Goal** right now to lock in this discount!"
                            : "🔥 *Exclusive Launch Offer!* 🔥\n\nMubarak ho! Aap premium design par **Flat 20% Discount** ke liye eligible hain. \n\n👉 Is discount ko secure karne ke liye niche apna **Name aur Project Type** likh kar bhejien.";
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '4') {
                        replyText = (userLang === 'EN')
                            ? "💳 *Direct Booking & Token System ($49):*\n\nTo construct your live gateway invoice, please provide your **Full Name, Contact Number, and Project/Plan Name**."
                            : "💳 *Direct Booking & Token System (₹999 Slot Lock):*\n\nYour custom live checkout link banane ke liye, kripya apna **Name, Phone Number, aur Project Name/Plan** reply mein bhejien.";
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '5') {
                        replyText = (userLang === 'EN')
                            ? "👤 *Direct Consultation with Shahid:*\n\nShahid Alam will connect with you directly on this chat interface. What time slot should I schedule a call for you?"
                            : "👤 *Direct Consultation with Shahid:*\n\nShahid Alam aapke sath is chat par directly connect karenge. Aapko main kis time schedule par call arrange karu? Kindly niche batayein.";
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

// Standard Helper Function for Meta Message API
async function sendWhatsAppMessage(to, text) {
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = "1202984902891472";

    await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } },
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Google Cloud Server is running successfully on port ${PORT}`);
});
