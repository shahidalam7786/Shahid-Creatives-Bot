const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// 🟢 LIGHTWEIGHT IN-MEMORY STORAGE (Render Safe)
const userSessions = {};

// 📈 DYNAMIC PRICING LEDGER MAPPING WITH +3.5% GATEWAY FEES FOR USD / +18% GST FOR INR
function calculateTotalPayable(basePrice, isUSD = false) {
    const cleanBase = parseFloat(basePrice.toString().replace(/[^0-9.]/g, ''));
    if (isNaN(cleanBase)) return 0;
    
    if (isUSD) {
        // Base Plan + 3.5% Stripe/PayPal Gateway Processor Processing Fee
        const totalUSD = cleanBase * 1.035;
        return Math.round(totalUSD);
    } else {
        // Standard Indian domestic structure (Base + 18% GST + 2.5% Portal Gateway)
        const withGST = cleanBase * 1.18; 
        const totalPayable = withGST * 1.025; 
        return Math.round(totalPayable);
    }
}

// 🎯 ROBUST PLAN PRICE MAPPER (Strictly Ordered by USD & INR Specifications)
function getBasePriceByPlan(planScope, isUSD = false) {
    const text = String(planScope).toLowerCase().trim();
    
    if (isUSD) {
        if (text.includes("whatsapp chatbot") || text.includes("chatbot") || text.includes("bot")) return "110";
        if (text.includes("starter plan") || text.includes("visiting card") || text.includes("starter / visiting card site")) return "199";
        if (text.includes("basic plan") || text.includes("landing page")) return "299";
        if (text.includes("starter business") || text.includes("business website")) return "499";
        if (text.includes("e-commerce hub") || text.includes("ecommerce")) return "899";
        if (text.includes("custom enterprise") || text.includes("software")) return "2499";
        return "110";
    } else {
        if (text.includes("whatsapp bot") || text.includes("lead sync")) return "8713";
        if (text.includes("landing page") || text.includes("funnel")) return "12300";
        if (text.includes("crm workflow") || text.includes("workflow hub")) return "18000";
        if (text.includes("business") || text.includes("corporate")) return "25500";
        if (text.includes("e-commerce") || text.includes("store")) return "47500";
        if (text.includes("saas") || text.includes("software")) return "145000";
        return "8713"; 
    }
}

// 🤖 BACKGROUND TIMEOUT ENGINE: 10-Minute Automated Nudge Follow-up (Except during custom time setups)
setInterval(() => {
    const now = Date.now();
    for (const from in userSessions) {
        const session = userSessions[from];
        if (session && session.step !== 'completed' && session.step !== 'post_registration' && session.step !== 'awaiting_custom_time_input' && (now - session.lastInteractionTime > 600000) && !session.nudgeSent) {
            const nudgeMessage = (session.lang === 'EN')
                ? "Hi! I noticed you were exploring our premium development options. Do you have any questions or need help locking in your slot? 😊"
                : "Hi! Maine dekha aap Shahid Creatives ki services explore kar rahe the. Kya aapko koi sawal hai ya coupon lock karne me koi help chahiye? 😊";
            
            sendWhatsAppMessage(from, nudgeMessage);
            session.nudgeSent = true; 
        }
    }
}, 60000);

// 🤖 SERVER HEALTH CHECK
app.get('/', (req, res) => {
    res.status(200).send("Shahid Creatives Bot Server is Live on Render with Secured Credentials! 🚀");
});

// 🟢 ROUTE HANDLER: Client Credentials Logs Delivery
app.post('/send-client-credentials', async (req, res) => {
    try {
        const payload = req.body;
        await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
            client_name: payload.name || payload.client_name || "API Inbound Portal Lead",
            whatsapp_number: payload.phone || payload.whatsapp_number || "0000000000",
            project_scope: payload.plan || payload.project_scope || "Credentials Sync Event",
            calculated_price: payload.price || payload.calculated_price || 0,
            email: payload.email || "Not Provided"
        });
        res.status(200).json({ success: true, message: "Credentials Packet routed securely!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🟢 ROUTE HANDLER: Payment Reminders Dispatch Engine
app.post('/send-payment-reminder', async (req, res) => {
    try {
        const payload = req.body;
        const clientPhone = payload.phone || payload.whatsapp_number;
        if (!clientPhone) return res.status(400).json({ success: false, error: "Missing number" });

        const reminderMessage = `⚠️ *Payment Pending Reminder - Shahid Creatives* 🚀\n\nHello,\n\nThis is a quick reminder regarding your slot confirmation booking using your dynamic pay gateway dashboard link to avoid slot cancellation. 👍`;
        await sendWhatsAppMessage(clientPhone, reminderMessage);
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Meta Webhook Verification
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "shahid_creatives_secret_token_123";
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
});

// Main Webhook Logic for Processing Messages
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
                    
                    const isInternationalNumber = !from.startsWith("91");
                    const isGlobalWebsiteTemplate = rawText.includes("Global USD") || rawText.includes("Worldwide") || rawText.includes("$") || rawText.includes("lock in my custom website estimate");

                    // ⚡ Reset mechanism for fallback restart
                    const resetTriggers = ['hi', 'hello', 'menu', 'start', 'hey'];
                    if (resetTriggers.includes(userText)) {
                        userSessions[from] = null;
                    }

                    // 🎯 TOP PRIORITY INTERCEPTOR: WEBSITE INBOUND FORM SYNC
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate") || rawText.includes("Estimated Price:") || rawText.includes("Grand Total:")) {
                        if (userSessions[from] && userSessions[from].lastSubmitedTime && (Date.now() - userSessions[from].lastSubmitedTime < 15000)) { return; }
                        
                        let clientName = "Valued Client";
                        let clientEmail = "Not Provided";
                        let projectScope = "Website Custom Estimate";
                        let parsedBasePrice = "199"; 
                        
                        try {
                            const nameMatch = rawText.match(/(?:Client Name|👤[^:]*):\s*([^\n\r]+)/i);
                            const scopeMatch = rawText.match(/(?:Plan Chosen|Category Model|Specifications[^:]*):\s*([^\n\r]+)/i);
                            const priceMatch = rawText.match(/(?:Estimated Price|Base Price|Price|Grand Total[^:]*):\s*\$([0-9.]+)/i);
                            
                            if (nameMatch) clientName = nameMatch[1].split('\n')[0].split(',')[0].trim();
                            if (scopeMatch) projectScope = scopeMatch[1].replace(/[\*•\-]/g, '').trim();
                            if (priceMatch) parsedBasePrice = priceMatch[1].trim();
                            
                            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                            const emailMatch = rawText.match(globalEmailRegex);
                            if (emailMatch) clientEmail = emailMatch[1].trim();
                        } catch (parseError) { console.error("Parser failure exception inside landing template."); }

                        // 🛑 CRITICAL PAID FILTER: Check if user has already paid the amount
                        if (userText.includes("paid the full amount") || userText.includes("advance amount paid") || userText.includes("paid the full") || userText.includes("i just paid")) {
                            
                            userSessions[from] = {
                                step: 'post_registration',
                                lang: isInternationalNumber ? 'EN' : 'HINGLISH',
                                clientName: clientName,
                                clientEmail: clientEmail,
                                projectScope: projectScope,
                                lastSubmitedTime: Date.now(),
                                lastInteractionTime: Date.now(),
                                nudgeSent: true
                            };

                            // Notify Admin Panel
                            const paidAdminAlert = `✅ *PAID CLIENT REGISTERED!* ✅\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail}\n📝 *Plan Scope:* ${projectScope}\n💳 *Status:* Fully Paid via Portal Gateway!`;
                            await sendWhatsAppMessage("917529839762", paidAdminAlert);

                            try {
                                await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                    client_name: clientName,
                                    whatsapp_number: from,
                                    project_scope: `${projectScope} (Status: Fully Paid Portal Form)`,
                                    calculated_price: calculateTotalPayable(parsedBasePrice, isInternationalNumber),
                                    email: clientEmail
                                });
                            } catch (err) { console.error("Paid lead API sync error:", err.message); }

                            let paidSuccessReply = (userSessions[from].lang === 'EN')
                                ? `Thank you *${clientName}*! 🙏 Your paid booking has been successfully verified on our dashboard.\n\n⚡ *Status:* **Project Consultation Stage Activated!**\n\nShahid has been notified and we are setting up your development blueprint environment. We will connect with you shortly for the strategic sync session! 🚀`
                                : `Mubarak ho *${clientName}*! 🙏 Aapki payment received data hamare dashboard par successfully sync ho gayi hai.\n\n⚡ *Status:* **Project Consultation Stage Active!**\n\nShahid bhai aapke project parameters verify kar rahe hain. Hamari team strategy aur architecture mapping discovery call ke liye aapse bohot jald raabta karegi! 🚀`;
                            
                            return sendWhatsAppMessage(from, paidSuccessReply);
                        }

                        // Otherwise execute normal link flow if unpaid lead arrives
                        userSessions[from] = {
                            step: 'awaiting_website_action',
                            lang: 'EN', 
                            clientName: clientName,
                            clientEmail: clientEmail,
                            projectScope: projectScope,
                            lastSubmitedTime: Date.now(),
                            lastInteractionTime: Date.now(),
                            nudgeSent: false
                        };

                        const calculatedPrice = calculateTotalPayable(parsedBasePrice, true);
                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* +${from}\n👤 *Name:* ${clientName}\n📝 *Plan:* ${projectScope}\n💰 *Price:* $${calculatedPrice}`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { client_name: clientName, whatsapp_number: from, project_scope: projectScope, calculated_price: calculatedPrice, email: clientEmail });
                        } catch (err) { console.error("Meta Dashboard sync err."); }

                        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                        const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=49&currency=USD&totalPrice=${calculatedPrice}&name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail)}&phone=${from}&plan=${encodeURIComponent(projectScope)}&coupon=LAUNCH20`;

                        let clientReply = `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved to our dashboard.\n\n🔥 *Exclusive Reward Activated:* Launch code **LAUNCH20** secures a **Flat 20% OFF** discount linked directly to your project value.\n\n🔗 *Pay Securely Here (USD Slot Guarantee):* ${selfPayLink}`;
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    // Fallback initialization if session is clean
                    if (!userSessions[from]) {
                        userSessions[from] = { 
                            step: 'region_check', 
                            lang: (isInternationalNumber || isGlobalWebsiteTemplate) ? 'EN' : 'HINGLISH', 
                            clientName: "Valued Client", 
                            clientEmail: "", 
                            projectScope: "Custom Project Development",
                            lastSubmitedTime: 0,
                            lastInteractionTime: Date.now(),
                            nudgeSent: false
                        };
                    }
                    
                    userSessions[from].lastInteractionTime = Date.now();
                    userSessions[from].nudgeSent = false;

                    const userLang = userSessions[from].lang;
                    const currentStep = userSessions[from].step;

                    // 🎯 FIXED GLOBAL PRIORITY STATE 0: COURTESY REPLIES RESET BUFFER
                    const courtesyTriggers = ['thanks', 'thank you', 'ok', 'okay', 'ji', 'shukriya', 'thx'];
                    if (courtesyTriggers.includes(userText)) {
                        userSessions[from] = null; 
                        let courtesyReply = (userLang === 'EN')
                            ? "You're most welcome! 👍 Glad to help. Type 'Menu' anytime if you want to explore again."
                            : "Aapka swagat hai! 👍 Milte hain aapse bohot jald discovery call par. Dobara shuru karne ke liye kisi bhi waqt 'Menu' ya 'Hi' bheinje.";
                        return sendWhatsAppMessage(from, courtesyReply);
                    }

                    // 🎯 STATE -1: REGION CHECK ENGINE
                    if (currentStep === 'region_check') {
                        let processedRoute = false;
                        
                        if (userText === '1' || userText.includes("india") || userText.includes("inr")) {
                            userSessions[from].lang = 'HINGLISH';
                            userSessions[from].step = 'main_menu';
                            processedRoute = true;
                        } else if (userText === '2' || userText.includes("outside") || userText.includes("usd") || userText.includes("global") || isInternationalNumber) {
                            userSessions[from].lang = 'EN';
                            userSessions[from].step = 'main_menu';
                            processedRoute = true;
                        }

                        if (processedRoute) {
                            let replyText = "";
                            if (userSessions[from].lang === 'EN') {
                                replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nWe design premium agile web ecosystems and high-converting automation workflows.\n\nSelect a professional stack tier via option number:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation Hub**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid (Direct Consultation)**";
                            } else {
                                replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nHum engineer karte hain high-performance websites aur AI automation frameworks.\n\nKoshish ko aage badhane ke liye ek option number reply kijiye:\n\n1️⃣ *Web Development Tiers* (Saare Standard Custom Packages)\n2️⃣ *AI Business Automation & B2B Wholesale Demo*\n3️⃣ *🔥 Exclusive Launch Deal* (Flat 20% OFF Status)\n4️⃣ *💳 Direct Booking & Token System* (₹999 Secure Path)\n5️⃣ *👤 Talk to Shahid* (Direct Consultation)";
                            }
                            return sendWhatsAppMessage(from, replyText);
                        } else {
                            let WelcomeGateText = "Welcome to *Shahid Creatives*! 🚀 Please select your location layout to proceed:\n\n1️⃣ **India (Tax/Billing: ₹ INR)**\n2️⃣ **Outside India (Global Billing: $ USD)**\n\n👉 Reply with *1 or 2* to initialize setup!";
                            return sendWhatsAppMessage(from, WelcomeGateText);
                        }
                    }

                    // 🎯 DEDICATED CAPTURE ROUTE FOR CUSTOM SCHEDULING TEXT
                    if (currentStep === 'awaiting_custom_time_input') {
                        userSessions[from].step = 'collect_consultation_identity';
                        userSessions[from].projectScope = `Direct Consultation Slot: Custom Input ("${rawText}")`;
                        
                        let askIdentityText = (userLang === 'EN')
                            ? `Got it! Custom slot parameters recorded: *"${rawText}"*\n\n✍ *Please complete your profile:* Kindly reply with your *Full Name* and *Email Address*.`
                            : `Noted! Aapka preferred date/time save ho gaya hai: *"${rawText}"*\n\n✍ *Apna profile register karein:* Kripya reply mein apna *Full Name* aur *Email ID* bheinjein.`;
                        return sendWhatsAppMessage(from, askIdentityText);
                    }

                    // 🎯 STATE 1: COLLECT IDENTITY (DEEP DETAILED EXPLORATION QUESTIONNAIRE)
                    if (currentStep === 'collect_consultation_identity') {
                        userSessions[from].step = 'collect_custom_query_and_time'; 
                        let cleanName = rawText.split('\n')[0].split(',')[0].trim();
                        userSessions[from].clientName = cleanName;

                        let descriptivePrompt = "";
                        if (userLang === 'EN') {
                            descriptivePrompt = `Thank you *${cleanName}*! 🙏\n\nTo lock a high-converting strategy blueprint, please share your goals in the next reply:\n\n🌐 **1. Website Development:**\nWhich dynamic plan fits your vision? (Starter Plan, Basic Plan, Starter Business Site, or E-Commerce Hub?)\n\n🤖 **2. AI Automation Goals:**\nWhat precise processes do you want to automate? (WhatsApp Chatbots, Custom CRM workflows, or Auto Sheet Database logging?)`;
                        } else {
                            descriptivePrompt = `Thank you *${cleanName}*! 🙏\n\nStrategy call ko 100% efficient banane ke liye, kripya agle message mein niche di gayi details batayein:\n\n🌐 **1. Website Development:**\nAap kis tarah ka plan model ya scope dekh rahe hain? (Landing Page, Corporate Layout Showcase, ya Product Selling E-commerce Store?)\n\n🤖 **2. AI Automation Goals:**\nAapko business architecture me kya karwana hai? (Auto Lead Generation system, Automated CRM follow-ups, ya custom Google Sheets sync workflows?)`;
                        }
                        return sendWhatsAppMessage(from, descriptivePrompt);
                    }

                    // 🎯 STATE 2: DISPATCH CUSTOM QUERY & TIME TO DASHBOARD
                    if (currentStep === 'collect_custom_query_and_time') {
                        userSessions[from].step = 'post_registration';
                        const cleanName = userSessions[from].clientName;
                        const finalScope = userSessions[from].projectScope;

                        const comprehensiveAdminAlert = `🚨 *PRE-QUALIFIED B2B CONSULTATION LEAD!* 🚨\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n📝 *Slot Details & Parameters:* ${finalScope}\n💬 *User Stated Objectives:* "${rawText}"\n\n🤖 *Status:* Live details captured securely!`;
                        await sendWhatsAppMessage("917529839762", comprehensiveAdminAlert);

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: cleanName,
                                whatsapp_number: from,
                                project_scope: `${finalScope} | Goals: "${rawText}"`,
                                calculated_price: 0,
                                email: userSessions[from].clientEmail || "Not Provided"
                            });
                        } catch (apiErr) { console.error("Admin Dashboard tracking pipeline err."); }

                        let confirmationText = (userLang === 'EN')
                            ? `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Your specifications have been securely routed to Shahid. We will connect with you shortly! 🚀`
                            : `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Aapka requirement details Shahid bhai tak pahunch gaya hai. Hamari team aapse jald hi raabta karegi! 🚀`;
                        return sendWhatsAppMessage(from, confirmationText);
                    }

                    // 🎯 STATE 3: INBOUND SEQUENCE - DETAILS ACQUISITION (Fallback)
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = rawText;
                        userSessions[from].step = 'ask_name_email';
                        let replyText = (userLang === 'EN') ? "Awesome! 📝 Kindly reply with your **Full Name** and **Email Address**." : "Awesome! 📝 Kripya apna **Full Name** aur **Email ID** bhej lijiye.";
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 🎯 STATE 4: INBOUND CHAT REGISTRATION COMPLETED
                    if (currentStep === 'ask_name_email') {
                        userSessions[from].step = 'completed'; 
                        let cleanName = rawText.split('\n')[0].split(',')[0].trim();
                        let cleanEmail = "Not Provided";
                        
                        const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                        const emailMatch = rawText.match(globalEmailRegex);
                        if (emailMatch) cleanEmail = emailMatch[1].trim();

                        userSessions[from].clientName = cleanName;
                        userSessions[from].clientEmail = cleanEmail;

                        const isUSDTrack = (userLang === 'EN');
                        const matchedBasePrice = getBasePriceByPlan(userSessions[from].projectScope, isUSDTrack);
                        const finalPayable = calculateTotalPayable(matchedBasePrice, isUSDTrack);
                        
                        const currencySymbol = isUSDTrack ? '$' : '₹';
                        const taxLabel = isUSDTrack ? 'incl Gateway Fees' : 'incl GST';

                        const chatAdminNotification = `🌟 *NEW INBOUND CHAT LEAD!* 🌟\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n📝 *Plan Scope:* ${userSessions[from].projectScope}\n💰 *Calculated Price (${taxLabel}):* ${currencySymbol}${finalPayable}`;
                        await sendWhatsAppMessage("917529839762", chatAdminNotification);

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { client_name: cleanName, whatsapp_number: from, project_scope: userSessions[from].projectScope, calculated_price: finalPayable, email: cleanEmail });
                        } catch (dashboardError) { console.error("Admin Sync exception logic execution handler."); }

                        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                        const encodedName = encodeURIComponent(cleanName);
                        const encodedEmail = encodeURIComponent(cleanEmail);
                        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);

                        let replyText = "";
                        if (isUSDTrack) {
                            const tokenAmountUSD = "49";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&currency=USD&totalPrice=${finalPayable}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Thank you, your profile is secure! 🤝\n\n🔥 *Launch Discount Applied:* Your code **LAUNCH20** (Flat 20% OFF) is successfully linked to your project estimate of $${finalPayable}.\n\n🔗 *Pay Securely Here (USD Slot Guarantee):* ${selfPayLink}`;
                        } else {
                            const tokenAmountINR = "999";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&currency=INR&totalPrice=${finalPayable}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Mubarak ho! Aapki requirement *${userSessions[from].projectScope}* register ho gayi hai! 🤝\n\n🔥 *Launch Discount Applied:* Coupon code **LAUNCH20** active ho gaya hai aapke ₹${finalPayable} estimate par. Aap niche diye gaye link se **₹999 Token Booking** complete karke discount slot lock karein:\n\n🔗 *Direct Pay Gateway Link:* ${selfPayLink}`;
                        }
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 🎯 STATE 5: INTERCEPTING MENU CHOICES FOR WEBSITE ACTION
                    if (currentStep === 'awaiting_website_action') {
                        if (userText === '1' || userText.includes("token") || userText.includes("book") || userText.includes("confirm")) {
                            userSessions[from].step = 'process_requirement_menu';
                            let requirementPrompt = (userLang === 'EN')
                                ? "Please select what you want to build today by replying with the option number (**1 to 6**):\n\n1️⃣ WhatsApp Chatbot ($110)\n2️⃣ Starter Plan ($199)\n3️⃣ Basic Plan ($299)\n4️⃣ Starter Business Site ($499)\n5️⃣ E-Commerce Hub ($899)\n6️⃣ Custom Enterprise App ($2,499)"
                                : "Perfect! Pehle aapki structural requirement lock kar lete hain. 🚀\n\nNiche diye gaye options mein se koi ek number (*1 se 5*) reply kijiye:\n\n1️⃣ **WhatsApp AI Chatbot & Automation** (Base: ₹8,713)\n2️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n3️⃣ **Business/Corporate Website** (Base: ₹25,500)\n4️⃣ **E-commerce Website** (Base: ₹47,500)\n5️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)";
                            return sendWhatsAppMessage(from, requirementPrompt);
                        } else if (userText === '2' || userText.includes("discuss") || userText.includes("call") || userText.includes("strategy")) {
                            userSessions[from].step = 'post_registration';
                            let replyText = (userLang === 'EN') ? "👤 Perfect! Shahid will connect with you shortly for a strategy sync call." : "👤 Perfect! Shahid bhai bohot jald aapke sath strategy call par connect karenge. Get ready to launch! 🚀";
                            return sendWhatsAppMessage(from, replyText);
                        }
                    }

                    // 🎯 STATE 5.1: PROCESSOR FOR SUB-MENU
                    if (currentStep === 'process_requirement_menu') {
                        let isMatchFound = false;
                        let dynamicCategory = "";
                        const isUSDTrack = (userLang === 'EN');

                        if (isUSDTrack) {
                            if (userText === '1' || userText.includes("chatbot") || userText.includes("bot")) { dynamicCategory = "WhatsApp Chatbot"; isMatchFound = true; }
                            else if (userText === '2' || userText.includes("starter plan")) { dynamicCategory = "Starter Plan"; isMatchFound = true; }
                            else if (userText === '3' || userText.includes("basic plan")) { dynamicCategory = "Basic Plan"; isMatchFound = true; }
                            else if (userText === '4' || userText.includes("starter business")) { dynamicCategory = "Starter Business Site"; isMatchFound = true; }
                            else if (userText === '5' || userText.includes("e-commerce hub")) { dynamicCategory = "E-Commerce Hub"; isMatchFound = true; }
                            else if (userText === '6' || userText.includes("custom enterprise")) { dynamicCategory = "Custom Enterprise App"; isMatchFound = true; }
                        } else {
                            if (userText === '1' || userText === 'ai' || userText.includes("chatbot")) { dynamicCategory = "WhatsApp AI Chatbot & Automation"; isMatchFound = true; }
                            else if (userText === '2' || userText.includes("landing")) { dynamicCategory = "Landing Page/Funnel (Single Page Lead Gen)"; isMatchFound = true; }
                            else if (userText === '3' || userText.includes("business")) { dynamicCategory = "Business/Corporate Website (Brand Showcase)"; isMatchFound = true; }
                            else if (userText === '4' || userText.includes("e-commerce")) { dynamicCategory = "E-commerce Website (Online Store)"; isMatchFound = true; }
                            else if (userText === '5' || userText.includes("software")) { dynamicCategory = "Custom Web Application / Software"; isMatchFound = true; }
                        }

                        if (isMatchFound) {
                            userSessions[from].step = 'ask_name_email';
                            userSessions[from].projectScope = dynamicCategory;
                            let askDetailsText = isUSDTrack
                                ? `Awesome! Selected: *${dynamicCategory}*. 📝 Kindly reply with your **Full Name** and **Email Address** to construct your quote profile.`
                                : `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bhej lijiye taaki aapka profile safe ho sake.`;
                            return sendWhatsAppMessage(from, askDetailsText);
                        } else {
                            let fallbackMsg = isUSDTrack ? "❌ Invalid choice. Reply from *1 to 6*." : "❌ Samajh nahi paye. Kripya list mein se ek number (*1 se 5*) bheinje.";
                            return sendWhatsAppMessage(from, fallbackMsg);
                        }
                    }

                    // 🎯 STATE 5.2: PROCESS AUTOMATION REQ SELECTION
                    if (currentStep === 'process_automation_menu') {
                        let isAutomateMatch = false;
                        let dynamicCategory = "";

                        if (userText === '1' || userText.includes("bot")) { dynamicCategory = "WhatsApp AI Chatbot & Lead Sync"; isAutomateMatch = true; }
                        else if (userText === '2' || userText.includes("crm")) { dynamicCategory = "Custom CRM Workflow Hub"; isAutomateMatch = true; }
                        else if (userText === '3' || userText.includes("enterprise")) { dynamicCategory = "Enterprise AI Suite (Tailored Architecture)"; isAutomateMatch = true; }

                        if (isAutomateMatch) {
                            userSessions[from].step = 'ask_name_email';
                            userSessions[from].projectScope = dynamicCategory;
                            let askDetailsText = (userLang === 'EN')
                                ? `Excellent Selection: *${dynamicCategory}*. 🤖 📝 Kindly reply with your **Full Name** and **Email Address** to proceed.`
                                : `Excellent Selection! Aapne *${dynamicCategory}* choose kiya hai. 🤖 📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bheinje.`;
                            return sendWhatsAppMessage(from, askDetailsText);
                        } else {
                            let fallbackMsg = (userLang === 'EN') ? "❌ Invalid selection. Reply from *1 to 3*." : "❌ Kripya list mein se sirf *1, 2 ya 3* hi likhein.";
                            return sendWhatsAppMessage(from, fallbackMsg);
                        }
                    }

                    // 🎯 STATE 6: CONSULTATION FIXED SLOTS ROUTING
                    if (currentStep === 'awaiting_consultation_slot') {
                        if (userText === 'a' || userText.includes("today") || userText.includes("5")) {
                            userSessions[from].step = 'collect_consultation_identity'; 
                            userSessions[from].projectScope = "Direct Consultation Slot: Today at 5:00 PM";
                            await sendWhatsAppMessage("917529839762", `🚨 *SLOT REQUEST!* 🚨\n📱 +${from}\n⏰ Chosen Slot: Today at 5:00 PM`);
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✍ *Please complete your profile:* Kindly reply with your *Full Name and Email Address*." : "✍ *Apna profile register karein:* Kripya apna *Full Name* aur *Email ID* reply mein bhejien.");
                        } else if (userText === 'b' || userText.includes("tomorrow") || userText.includes("12")) {
                            userSessions[from].step = 'collect_consultation_identity'; 
                            userSessions[from].projectScope = "Direct Consultation Slot: Tomorrow at 12:00 PM";
                            await sendWhatsAppMessage("917529839762", `🚨 *SLOT REQUEST!* 🚨\n📱 +${from}\n⏰ Chosen Slot: Tomorrow at 12:00 PM`);
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✍ *Please complete your profile:* Kindly reply with your *Full Name and Email Address*." : "✍ *Apna profile register karein:* Kripya apna *Full Name* aur *Email ID* reply mein bhejien.");
                        } else if (userText === 'c' || userText.includes("custom")) {
                            // 🚀 REDIRECTING USER TO A DEDICATED INPUT FIELD FIRST
                            userSessions[from].step = 'awaiting_custom_time_input';
                            let triggerCustomTimeMsg = (userLang === 'EN')
                                ? "📅 *Custom Scheduling Activated!* \n\nPlease type your preferred **Date and Time** below (e.g., *Monday at 3 PM* or *06th July, 4:00 PM*):"
                                : "📅 *Custom Scheduling Active!* \n\nKripya jis **Date aur Time** par aap call chahte hain, use niche type karke send karein (jaise: *Kal dopahar 3 baje* ya *6 July, shaam 4 baje*):";
                            return sendWhatsAppMessage(from, triggerCustomTimeMsg);
                        }
                    }

                    // 🎯 STATE 8: CORE ENGINE - HYBRID GLOBAL PARSER
                    if (currentStep === 'welcome' || currentStep === 'main_menu') {
                        userSessions[from].step = 'main_menu';
                        
                        let isCoreMatch = false;
                        let targetMenuRoute = userText;

                        if (userText === '1' || userText.includes("web") || userText.includes("site")) { targetMenuRoute = '1'; isCoreMatch = true; }
                        else if (userText === '2' || userText.includes("automation") || userText.includes("bot")) { targetMenuRoute = '2'; isCoreMatch = true; }
                        else if (userText === '3' || userText.includes("deal") || userText.includes("discount")) { targetMenuRoute = '3'; isCoreMatch = true; }
                        else if (userText === '4' || userText.includes("book") || userText.includes("token")) { targetMenuRoute = '4'; isCoreMatch = true; }
                        else if (userText === '5' || userText.includes("shahid") || userText.includes("talk")) { targetMenuRoute = '5'; isCoreMatch = true; }

                        let replyText = "";
                        if (!isCoreMatch) {
                            if (userLang === 'EN') {
                                replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nWe design premium agile web ecosystems and high-converting automation workflows.\n\nSelect a professional stack tier via number:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation & B2B Wholesale Demo**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid**";
                            } else {
                                replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nHum engineer karte hain high-performance websites aur AI automation frameworks.\n\nKoshish ko aage badhane ke liye niche se ek option text ya number reply kijiye:\n\n1️⃣ *Web Development Tiers* (Saare Standard Custom Packages)\n2️⃣ *AI Business Automation & B2B Wholesale Demo* (Bots & CRM Flows)\n3️⃣ *🔥 Exclusive Launch Deal* (Flat 20% OFF Status)\n4️⃣ *💳 Direct Booking & Token System* (₹999 Secure Path)\n5️⃣ *👤 Talk to Shahid* (Direct Consultation)";
                            }
                            return sendWhatsAppMessage(from, replyText);
                        }

                        if (targetMenuRoute === '1') {
                            userSessions[from].step = 'process_requirement_menu'; 
                            replyText = (userLang === 'EN')
                                ? "Please select what you want to build today by replying with the option number (**1 to 6**):\n\n1️⃣ WhatsApp Chatbot ($110)\n2️⃣ Starter Plan ($199)\n3️⃣ Basic Plan ($299)\n4️⃣ Starter Business Site ($499)\n5️⃣ E-Commerce Hub ($899)\n6️⃣ Custom Enterprise App ($2,499)"
                                : "Kripya select kijiye ki aap kya banwana chahte hain, reply mein number (**1 se 5**) ya package ka naam likhein:\n\n1️⃣ **WhatsApp AI Chatbot & Automation** (Base: ₹8,713)\n2️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n3️⃣ **Business/Corporate Website** (Base: ₹25,500)\n4️⃣ **E-commerce Website** (Base: ₹47,500)\n5️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)";
                        } else if (targetMenuRoute === '2') {
                            userSessions[from].step = 'process_automation_menu'; 
                            replyText = (userLang === 'EN')
                                ? "🤖 **AI Business Automation Hub**\nPlease reply with an option number (**1 to 3**):\n\n1️⃣ WhatsApp Bot & Lead Sync ($110)\n2️⃣ Custom CRM Workflow Hub ($220)\n3️⃣ Enterprise AI Suite (Tailored)\n\n📲 *Live Wholesale B2B Automation Demo:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo"
                                : "🤖 **AI Business Automation & Live Demo:**\nKripya niche diye gaye list mein se ek option number (**1 se 3**) ya naam reply kijiye:\n\n1️⃣ **WhatsApp Bot & Lead Sync** (Base: ₹8,713)\n2️⃣ **Custom CRM Workflow Hub** (Base: ₹18,000)\n3️⃣ **Enterprise AI Suite** (Custom Architecture)\n\n📲 *Live Wholesale B2B Automation Demo Link:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo";
                        } else if (targetMenuRoute === '3') {
                            userSessions[from].step = 'process_requirement_menu'; 
                            replyText = (userLang === 'EN')
                                ? "🔥 *Exclusive Launch Offer Active!* (Flat 20% OFF Code Applied)\n\nPlease select your project requirement number (1 to 6) to secure your discounted slot:\n\n1️⃣ WhatsApp Chatbot ($110)\n2️⃣ Starter Plan ($199)\n3️⃣ Basic Plan ($299)\n4️⃣ Starter Business Site ($499)\n5️⃣ E-Commerce Hub ($899)\n6️⃣ Custom Enterprise App ($2,499)"
                                : "🔥 *Exclusive Launch Offer Active!* (Flat 20% OFF Coupon apply kar diya gaya hai)\n\nAap jis requirement par discount lock karna chahte hain, kripya uska number (**1 se 5**) reply kijiye:\n\n1️⃣ **WhatsApp AI Chatbot & Automation** (Base: ₹8,713)\n2️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n3️⃣ **Business/Corporate Website** (Base: ₹25,500)\n4️⃣ **E-commerce Website** (Base: ₹47,500)\n5️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)";
                        } else if (targetMenuRoute === '4') {
                            userSessions[from].step = 'process_requirement_menu'; 
                            replyText = (userLang === 'EN')
                                ? "💳 *Direct Booking & Token System ($49)*\n\nPlease select the project type you want to lock slot for via option number (1 to 6):\n\n1️⃣ WhatsApp Chatbot ($110)\n2️⃣ Starter Plan ($199)\n3️⃣ Basic Plan ($299)\n4️⃣ Starter Business Site ($499)\n5️⃣ E-Commerce Hub ($899)\n6️⃣ Custom Enterprise App ($2,499)"
                                : "💳 *Direct Booking & Token System (₹999 Slot Lock)*\n\nAap jis project layout ke liye secure token register karna chahte hain, kripya uska option number (**1 se 5**) bheinje:\n\n1️⃣ **WhatsApp AI Chatbot & Automation** (Base: ₹8,713)\n2️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n3️⃣ **Business/Corporate Website** (Base: ₹25,500)\n4️⃣ **E-commerce Website** (Base: ₹47,500)\n5️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)";
                        } else if (targetMenuRoute === '5') {
                            userSessions[from].step = 'awaiting_consultation_slot';
                            replyText = (userLang === 'EN')
                                ? `👤 *Direct Consultation with Shahid:*\nTo lock your free 15-minute growth strategy sync, select a slot:\n\n🅰️ **Today at 5:00 PM**\n🅱️ **Tomorrow at 12:00 PM**\n🅲️ **Custom Time (Type preferred time below)**\n\n👉 Kindly reply with *A, B, or C* to secure your slot!`
                                : `👤 *Direct Consultation with Shahid:*\nShahid Alam aapke sath directly connect karenge. Priority growth consultation slot book karne ke liye ek option choose karein:\n\n🅰️ **Aaj hi Shaam 5:00 Baje**\n🅱️ **Kal Dopahar 12:00 Baje**\n🅲️ **Custom Time (Apna secure timing niche type karein)**\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye!`;
                        }
                        
                        return sendWhatsAppMessage(from, replyText);
                    }
                }
            }
        } catch (error) { console.error("Webhook processing logic error."); }
    }
});

async function sendWhatsAppMessage(to, text) {
    const SECURED_ACCESS_TOKEN = process.env.WHATSAPP_TOKEN; 
    const DEFAULT_PHONE_NUMBER_ID = "1202984902891472"; 
    try {
        await axios({
            method: "POST", 
            url: `https://graph.facebook.com/v18.0/${DEFAULT_PHONE_NUMBER_ID}/messages`,
            data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } },
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECURED_ACCESS_TOKEN}` }
        });
    } catch (e) { 
        console.error("WhatsApp API dispatch error:", e.response ? e.response.data : e.message); 
    }
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`ChatBot engine live on port ${PORT}`));
