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

// 🌟 UPGRADED SMART PLAN PRICE MAPPER (Fixes exact match & lowercase/uppercase mismatch bugs)
function getBasePriceByPlan(planScope) {
    const text = String(planScope).toLowerCase().trim();
    
    // 🛒 E-Commerce Tiers Validation
    if (text.includes("e-commerce") || text.includes("ecommerce") || text.includes("store") || text.includes("shop") || text.includes("retail")) {
        return "47500";
    }
    // 🌟 Starter Business Hub Tiers Validation
    if (text.includes("starter business") || text.includes("business hub") || text.includes("corporate") || text.includes("brand growth")) {
        return "25500";
    }
    // 💼 Basic Small Business Tiers Validation
    if (text.includes("basic small") || text.includes("small business") || text.includes("informational layout")) {
        return "12300";
    }
    // 🚀 Custom SaaS App / Enterprise Portals Validation
    if (text.includes("saas") || text.includes("app") || text.includes("software") || text.includes("enterprise") || text.includes("portal")) {
        return "145000";
    }
    // 🏢 Custom CRM Workflow Hub Validation
    if (text.includes("crm") || text.includes("workflow") || text.includes("sheet database")) {
        return "18000";
    }
    // 🤖 WhatsApp Bot & Lead Sync Validation
    if (text.includes("whatsapp bot") || text.includes("lead sync") || text.includes("conversational bot")) {
        return "8713";
    }
    
    return "8713"; // Safe ultimate fallback (Starter Plan)
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
                    // 🛡️ SECURITY STATE STEP: COMPLETED TRANSACTIONS PROTECTOR
                    // =========================================================
                    const resetTriggers = ['hi', 'hello', 'menu', 'start', 'hey'];
                    if (currentStep === 'completed' && !resetTriggers.includes(userText)) {
                        let fallbackNotice = (userLang === 'EN')
                            ? "💡 Your booking profile is already active! Please reply with *'Menu'* to go back or click the checkout gateway link above to proceed."
                            : "💡 Aapka booking invoice link generate ho chuka hai! Main menu par wapas jaane ke liye *'Menu'* type kijiye ya upar diye gaye secure link par click karke checkout complete kijiye.";
                        return sendWhatsAppMessage(from, fallbackNotice);
                    }

                    // =========================================================
                    // ⚙️ STATE RULE 1: CAPTURING REPLIES AFTER WEBSITE REDIRECT
                    // =========================================================
                    if (currentStep === 'awaiting_website_action') {
                        if (userText === '1') {
                            userSessions[from].step = 'completed'; 
                            const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                            const encodedName = encodeURIComponent(userSessions[from].clientName);
                            const encodedEmail = encodeURIComponent(userSessions[from].clientEmail || "");
                            const encodedPlan = encodeURIComponent(userSessions[from].projectScope);
                            
                            let replyText = "";
                            if (userLang === 'EN') {
                                const tokenAmountUSD = "49";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                                replyText = `領 *Excellent Choice!* Your session data is validated. 🤝\n\nClick the official link below to pay your **Token Booking fee ($49)** via Razorpay. This will instantly reserve your delivery slot in *Shahid Creatives* automated production queue:\n\n🔗 *Pay Securely Here:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                            } else {
                                const tokenAmountINR = "999";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                                replyText = `Thank you, aapki details receive ho gayi hain! 🤝\n\nMaine aapke chat data ke aadhar par aapka **Direct Token Payment Link** generate kar diya hai. Aap Razorpay se **₹999 Token Booking** complete karke apna slot instantly lock kar sakte hain:\n\n🔗 *Direct Pay Gateway Link:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                            }
                            return sendWhatsAppMessage(from, replyText);
                        } else if (userText === '2') {
                            userSessions[from].step = 'main_menu';
                            let replyText = (userLang === 'EN') ? "👤 Perfect! Shahid will connect with you shortly for a strategy sync call." : "👤 Perfect! Shahid bhai bohot jald aapke sath strategy call par connect karenge. Get ready to launch! 🚀";
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

                        userSessions[from].clientName = clientName;
                        userSessions[from].clientEmail = clientEmail;
                        userSessions[from].projectScope = projectScope;

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: clientName, 
                                email: clientEmail, 
                                whatsapp_number: from, 
                                project_scope: projectScope, 
                                value: parsedBasePrice // Directly mapping real calculator output values
                            });
                        } catch (apiError) { console.error("API Sync Failed"); }

                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail || 'Not Provided'}\n📝 *Plan:* ${projectScope}\n💰 *Value:* ₹${parsedBasePrice}\n\n🤖 *Status:* Locked & logged. Check Admin Panel!`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

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
                    // 3. INBOUND CHAT LEAD CAPTURE FLOW (B2B DIRECT CHAT)
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

                        // 🌟 DYNAMIC MATRIX RUNNER ACTIVE: Matches string and gets correct base price
                        const matchedBasePrice = getBasePriceByPlan(userSessions[from].projectScope);

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: cleanName, 
                                email: cleanEmail, 
                                whatsapp_number: from, 
                                project_scope: userSessions[from].projectScope, 
                                value: matchedBasePrice 
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
                    // 4. MAIN NAVIGATION MENU
                    // =========================================================
                    if (resetTriggers.includes(userText)) {
                        userSessions[from].step = 'main_menu';
                        if (userLang === 'EN') {
                            replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nWe design premium agile web ecosystems and high-converting automation workflows.\n\nSelect a professional stack tier via number:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid**";
                        } else {
                            replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nHum engineer karte hain high-performance websites aur AI automation frameworks global and local brands ke liye.\n\nKoshish ko aage badhane ke liye niche se ek option reply kijiye:\n\n1️⃣ *Web Development Tiers* (Saare Standard Custom Packages)\n2️⃣ *AI Business Automation* (WhatsApp Bots & CRM Flows)\n3️⃣ *🔥 Exclusive Launch Deal* (Flat 20% OFF Status)\n4️⃣ *💳 Direct Booking & Token System* (₹999 Secure Path)\n5️⃣ *👤 Talk to Shahid* (Direct Consultation)";
                        }
                    } else if (userText === '1') {
                        if (userLang === 'EN') {
                            replyText = "💻 *Shahid Creatives - Premium Web Tiers (All Available Packages):*\n\n• 💼 *Starter Premium Business Hub* ($299+) - Perfect for brand showcases. Includes 1-Yr Free Domain & Hosting.\n• 🛒 *Global E-commerce Engine* ($599) - Multi-currency Store + Stripe checkout automated integration.\n• 🚀 *Custom SaaS / Enterprise Portal* ($1,750+) - Tailored logic, secure multi-tenant databases & custom workflows.\n\n👉 Please reply with your preferred **Plan Name or Custom Specifications** to proceed!";
                        } else {
                            replyText = "💻 *Shahid Creatives - Web Development Tiers (Saare Plans Available):*\n\n• 📄 *Starter Plan* (Base Price: ₹8,713) - Portfolio, Single Page Landing, ya Online Visiting Card sites ke liye best.\n• 💼 *Basic Small Business* (Base Price: ₹12,300) - Informational layout (3-5 pages) local shops aur businesses ke liye.\n• 🌟 *Starter Business Hub* (Base Price: ₹25,500) - Complete corporate systems, brand growth layouts & lead capture systems.\n• 🛒 *E-commerce Hub* (Base Price: ₹47,500) - Full-fledged Online Store with Product Listing, Cart, Coupons & Billing gateways.\n• 🚀 *Custom SaaS App* (Base Price: ₹1,45,000+) - Scalable web applications, admin dashboards, and custom business tools.\n\n💡 Note: All prices are subject to +18% GST and 2.5% transaction charges.\n\n👉 Aap kaun sa package choose karna chahte hain? Niche uska naam ya specifications reply mein share kijiye!";
                        }
                        userSessions[from].step = 'collect_details';
                    } else if (userText === '2') {
                        if (userLang === 'EN') {
                            replyText = "🤖 *AI Business Automation Hub (All Available Configurations):*\n\n• 🤖 *Enterprise Custom AI Hub* ($299 onwards) - Multi-currency receipt automation, dynamic parameters link injection, Stripe gateway sync, and enterprise native infrastructure.\n\n👉 Reply with your business workflow or automation goal to initiate development!";
                        } else {
                            replyText = "🤖 *AI Business Automation - Service Tiers (Saare Plans Available):*\n\n• 🤖 *WhatsApp Bot & Lead Sync* (Base Price: ₹8,713) - Basic conversational bot, text parsing engine, dashboard real-time CRM synchronization.\n• 🏢 *Custom CRM Workflow Hub* (Base Price: ₹18,000) - Complete internal sheet database connectivity, automated tasks, priority alert paths.\n• 🚀 *Enterprise AI Automation Suite* (Tailored Pricing) - Multi-channel bots (WhatsApp + Web Widgets), complex webhooks handler, automated dynamic workflows.\n\n👉 Apne automation requirement or operation goals niche reply mein batayein!";
                        }
                        userSessions[from].step = 'collect_details';
                    } else if (userText === '3') {
                        replyText = (userLang === 'EN')
                            ? "🔥 *Exclusive Global Launch Offer!* 🔥\n\nWe have successfully mapped the launch coupon code **LAUNCH20** with your tracking node. This secures a **Flat 20% OFF** discount on your final project invoice bill!\n\n👉 Reply with your **Name and Project Goal** right now to tag your discount code!"
                            : "🔥 *Exclusive Launch Offer!* 🔥\n\nMubarak ho! Aap premium setup models par **Flat 20% Discount** ke liye eligible hain. Maine aapke session ke sath coupon code **LAUNCH20** active kar diya hai.\n\n👉 Is discount code ko secure karne ke liye niche apna **Name aur Project Type** likh kar bhejien.";
                        userSessions[from].step = 'collect_details';
                    } else if (userText === '4') {
                        replyText = (userLang === 'EN')
                            ? "💳 *Direct Booking & Token System ($49):*\n\nTo construct your dynamic link invoice panel, please provide your **Full Name, Contact Number, and Project/Plan Name**."
                            : "💳 *Direct Booking & Token System (₹999 Slot Lock):*\n\nYour custom live checkout portal status configure karne ke liye, kripya apna **Name, Phone Number, aur Project Name/Plan** reply mein bhejien.";
                        userSessions[from].step = 'collect_details';
                    } else if (userText === '5') {
                        replyText = (userLang === 'EN')
                            ? "👤 *Direct Consultation with Shahid:*\n\nShahid Alam will connect with you directly on this chat thread. What time slot should I schedule an alignment call for you?"
                            : "👤 *Direct Consultation with Shahid:*\n\nShahid Alam aapke sath is thread par directly connect karenge. Aapko main kis time schedule par priority consultation slot book karu? Kindly niche batayein.";
                        userSessions[from].step = 'collect_details';
                    } else {
                        replyText = (userLang === 'EN')
                            ? "I didn't quite catch that. 🤔 Please reply with *'Hi'* or *'Hello'* to open the main menu!"
                            : "Main samajh nahi paya. 🤔 Dobara structured menus dekhne ke liye ek baar *'Hi'* ya *'Hello'* bhejien!";
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
