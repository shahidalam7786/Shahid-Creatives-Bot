const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();
app.use(bodyParser.json());

// In-Memory Session Storage for Control Handshaking
const userSessions = {};

// DYNAMIC PRICING LEDGER MAPPING
function calculateTotalPayable(basePrice) {
    const cleanBase = parseFloat(basePrice.toString().replace(/[^0-9.]/g, ''));
    if (isNaN(cleanBase)) return 0;
    const withGST = cleanBase * 1.18; 
    const totalPayable = withGST * 1.025; 
    return Math.round(totalPayable);
}

// Meta Webhook Verification
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "shahid_creatives_secret_token_123";
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// Main Webhook Logic for Processing Messages
app.post('/webhook', async (req, res) => {
    res.sendStatus(200); // Meta instant 200 OK delivery handshake
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
                    const currentStep = userSessions[from].step;

                    // =========================================================
                    // ⚙️ STATE RULE 1: CAPTURING ACTION BUTTON 1 (SEND REAL LINK WITH DISCOUNT)
                    // =========================================================
                    if (currentStep === 'awaiting_website_action') {
                        if (userText === '1') {
                            userSessions[from].step = 'main_menu';
                            const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                            const encodedName = encodeURIComponent(userSessions[from].clientName);
                            const encodedEmail = encodeURIComponent(userSessions[from].clientEmail || "");
                            const encodedPlan = encodeURIComponent(userSessions[from].projectScope);
                            
                            let replyText = "";
                            if (userLang === 'EN') {
                                const tokenAmountUSD = "49";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                                replyText = `💳 *Perfect!* I have generated your unique secure project invoice link.\n\nClick the link below to pay your **Token Booking fee ($49)** via Razorpay. This will instantly reserve your slot in *Shahid Creatives* automated production timeline:\n\n🔗 *Pay Securely Here:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                            } else {
                                const tokenAmountINR = "999";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                                replyText = `Zabardast Choice! 👍 Maine aapka unique secure client booking invoice link generate kar diya hai.\n\nAap niche diye gaye secure path par click karke direct Razorpay se apna **₹999 Token Booking** complete kar sakte hain. Isse *Shahid Creatives* mein aapka slot automatic book ho jayega aur development kickoff active ho jayega:\n\n🔗 *Direct Pay Gateway Link:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}\n\n💡 Note: Payment complete hote hi hamara automated system onboarding processes filter kickoff kar dega! 🚀`;
                            }
                            return sendWhatsAppMessage(from, replyText);
                        } else if (userText === '2') {
                            userSessions[from].step = 'main_menu';
                            let replyText = (userLang === 'EN') ? "👤 Perfect! Shahid will connect with you shortly for a strategy sync call to freeze parameters." : "👤 Perfect! Shahid bhai bohot jald aapke sath strategy call par connect karenge taaki requirements ko finalize kiya ja sake. Get ready to launch! 🚀";
                            return sendWhatsAppMessage(from, replyText);
                        }
                    }

                    // =========================================================
                    // 🛡️ STATE RULE 2: LEAD DETECTION PARSING ENGINE (60s THROTTLE OVERLAP SAFE)
                    // =========================================================
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate")) {
                        
                        if (userSessions[from].lastSubmitedTime && (Date.now() - userSessions[from].lastSubmitedTime < 60000)) {
                            console.log(`[CRM INGESTION BLOCKED] Anti-duplicate protection locked for phone: ${from}`);
                            return;
                        }
                        userSessions[from].lastSubmitedTime = Date.now();

                        let clientName = "Valued Client";
                        let clientEmail = "";
                        let projectScope = "Website Custom Estimate";
                        let parsedBasePrice = "18000"; 
                        
                        try {
                            const nameMatch = rawText.match(/(?:Client Name|👤[^:]*):\s*([^\n\r]+)/i);
                            const scopeMatch = rawText.match(/(?:Category Model|Model|Specifications[^:]*):\s*([^\n\r]+)/i);
                            const priceMatch = rawText.match(/(?:Base Price|Price[^:]*):\s*([^\n\r]+)/i);
                            
                            if (nameMatch) clientName = nameMatch[1].split('\n')[0].split(',')[0].trim();
                            if (scopeMatch) projectScope = scopeMatch[1].replace(/[\*•\-]/g, '').trim();
                            if (priceMatch) parsedBasePrice = priceMatch[1].replace(/[^0-9.]/g, '').trim();
                            
                            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                            const emailMatch = rawText.match(globalEmailRegex);
                            if (emailMatch) clientEmail = emailMatch[1].trim();
                        } catch (parseError) {
                            console.error("Advanced custom parsing system exception:", parseError.message);
                        }

                        const finalCalculatedValue = calculateTotalPayable(parsedBasePrice);

                        userSessions[from].clientName = clientName;
                        userSessions[from].clientEmail = clientEmail;
                        userSessions[from].projectScope = projectScope;

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: clientName, email: clientEmail, whatsapp_number: from, project_scope: projectScope, value: finalCalculatedValue
                            });
                        } catch (apiError) { console.error("API Sync Failed"); }

                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail || 'Not Provided'}\n📝 *Plan:* ${projectScope}\n💰 *Value:* ₹${finalCalculatedValue}\n\n🤖 *Status:* Locked & logged. Check Admin Panel!`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        // 🌟 HOOK INTEGRATION: FIRST MESSAGE CONTAINS THE 20% DISCOUNT INSTANT PITCH
                        let clientReply = "";
                        if (userLang === 'EN') {
                            clientReply = `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved on our production server.\n\n🔥 *Exclusive Reward Activated:* We have successfully mapped the launch coupon code **LAUNCH20** with your tracking node. This secures a **Flat 20% OFF** discount on your final project invoice bill!\n\n🚀 Would you like to confirm your design deployment slot with a **Token Booking ($49)** or schedule a strategy kickoff call right away?\n\nPlease reply with the number of your choice:\n\n1️⃣ **Book Token (Confirm Slot & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Schedule Strategy Call)**`;
                        } else {
                            clientReply = `Thank you *${clientName}*! 🙏 Aapka cost estimation data hamare production server par secure ho gaya hai.\n\n🔥 *Exclusive Offer Activated:* Maine aapke project profile ke sath launch coupon code **LAUNCH20** को टैग कर दिया है! Isse payment complete hone ke baad aapke main project price par **Flat 20% OFF (Discount)** apply ho jayega.\n\n🚀 Kya aap apna development slot instantly lock karke discount secure karna chahte hain, ya direct details discuss karna chahte hain?\n\nNiche diye gaye number se reply kijiye:\n\n1️⃣ **Token Book Karein (Slot Confirm & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Strategy Call)**`;
                        }
                        
                        userSessions[from].step = 'awaiting_website_action';
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    // =========================================================
                    // 2. INBOUND CHAT LEAD CAPTURE FLOW (B2B DIRECT CHAT)
                    // =========================================================
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = rawText; 
                        userSessions[from].step = 'ask_name_email';
                        let replyText = (userLang === 'EN') ? "Awesome! 📝 Kindly reply with your **Full Name** and **Email Address**." : "Awesome! 📝 Kindly apna **Full Name** aur **Email ID** bhej lijiye.";
                        return sendWhatsAppMessage(from, replyText);
                    }

                    if (currentStep === 'ask_name_email') {
                        const contactDetails = rawText;
                        userSessions[from].step = 'completed';
                        let cleanName = contactDetails.split('\n')[0].split(',')[0].trim();
                        let cleanEmail = "";
                        const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                        const emailMatch = contactDetails.match(globalEmailRegex);
                        if (emailMatch) cleanEmail = emailMatch[1].trim();

                        userSessions[from].clientName = cleanName;
                        userSessions[from].clientEmail = cleanEmail;

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: cleanName, email: cleanEmail, whatsapp_number: from, project_scope: "ChatBot: " + userSessions[from].projectScope, value: "8713"
                            });
                        } catch (dbErr) { console.log("CRM sync fail"); }

                        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                        const encodedName = encodeURIComponent(cleanName);
                        const encodedEmail = encodeURIComponent(cleanEmail);
                        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);

                        let replyText = "";
                        if (userLang === 'EN') {
                            const tokenAmountUSD = "49";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Thank you, your profile is secure! 🤝\n\n🔥 *Launch Discount Applied:* Your code **LAUNCH20** (Flat 20% OFF) is successfully linked.\n\n🔗 *Pay Securely Here:* ${selfPayLink}\n\n*Reference ID:* ${uniqueProjectId}`;
                        } else {
                            const tokenAmountINR = "999";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Thank you, aapki details receive ho gayi hain! 🤝\n\n🔥 *Launch Discount Applied:* Maine aapke profile ke sath **LAUNCH20** (Flat 20% OFF) active kar diya hai. Aap Razorpay se **₹999 Token Booking** complete karke slot lock kar sakte hain. Isse *Shahid Creatives* mein aapka slot automatic book ho jayega:\n\n🔗 *Direct Pay Gateway Link:* ${selfPayLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                        }
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // =========================================================
                    // 3. MAIN NAVIGATION MENU
                    // =========================================================
                    if (userText === 'hi' || userText === 'hello' || userText === 'menu' || userText === 'start') {
                        userSessions[from].step = 'main_menu';
                        if (userLang === 'EN') {
                            replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nHow can we accelerate your business? Please reply with a number:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid**";
                        } else {
                            replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nAapko kis service ke baare mein jaanna hai? Niche diya gaya number reply mein bhejien:\n\n1️⃣ *Web Development Tiers*\n2️⃣ *AI Business Automation*\n3️⃣ *🔥 Exclusive Launch Deal*\n4️⃣ *💳 Direct Booking & Token System*\n5️⃣ *👤 Talk to Shahid*";
                        }
                    } else if (userText === '1') {
                        replyText = (userLang === 'EN') ? "💻 Premium Web Tiers. Please reply with requirements." : "💻 Web Tiers. Starter Plan (₹8,713) onwards. Please reply with requirements!";
                        userSessions[from].step = 'collect_details';
                    } else if (userText === '2') {
                        replyText = "🤖 AI Automation Hub. Share your workflow details.";
                        userSessions[from].step = 'collect_details';
                    } else if (userText === '3') {
                        replyText = "🔥 Flat 20% Discount. Share your name to lock.";
                        userSessions[from].step = 'collect_details';
                    } else if (userText === '4') {
                        replyText = "💳 Share Name, Phone, and Plan to generate dynamic link.";
                        userSessions[from].step = 'collect_details';
                    } else if (userText === '5') {
                        replyText = "👤 Shahid will connect shortly. Share your preferred meeting slot.";
                        userSessions[from].step = 'collect_details';
                    } else {
                        replyText = "Please reply with 'Hi' or 'Hello' to view the main menu.";
                    }
                    await sendWhatsAppMessage(from, replyText);
                }
            }
        } catch (error) { console.error("Webhook processing exception:", error.message); }
    }
});

// Standard Message Dispatch Helper
async function sendWhatsAppMessage(to, text) {
    const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
    const PHONE_NUMBER_ID = "1202984902891472";
    await axios({
        method: "POST", url: `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
        data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } },
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ChatBot engine live on port ${PORT}`));
