const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = report || express();
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

// 🎯 UPGRADED ROBUST PLAN PRICE MAPPER (Strictly Ordered by your New USD Specifications)
function getBasePriceByPlan(planScope, isUSD = false) {
    const text = String(planScope).toLowerCase().trim();
    
    if (isUSD) {
        if (text.includes("whatsapp chatbot") || text.includes("chatbot") || text.includes("bot")) {
            return "110";
        }
        if (text.includes("starter plan") || text.includes("visiting card")) {
            return "199";
        }
        if (text.includes("basic plan") || text.includes("landing page")) {
            return "299";
        }
        if (text.includes("starter business") || text.includes("business website")) {
            return "499";
        }
        if (text.includes("e-commerce hub") || text.includes("ecommerce") || text.includes("store")) {
            return "899";
        }
        if (text.includes("custom enterprise") || text.includes("software") || text.includes("app")) {
            return "2499";
        }
        return "110";
    } else {
        // Existing Standard Indian Domestic base currency layout rules
        if (text.includes("whatsapp bot") || text.includes("lead sync") || text.includes("conversational bot")) {
            return "8713";
        }
        if (text.includes("landing page") || text.includes("funnel")) {
            return "12300";
        }
        if (text.includes("crm workflow") || text.includes("workflow hub")) {
            return "18000";
        }
        if (text.includes("business") || text.includes("corporate") || text.includes("showcase")) {
            return "25500";
        }
        if (text.includes("e-commerce") || text.includes("ecommerce") || text.includes("store")) {
            return "47500";
        }
        if (text.includes("saas") || text.includes("app") || text.includes("software")) {
            return "145000";
        }
        return "8713"; 
    }
}

// 🤖 SERVER HEALTH CHECK (For 24/7 UptimeRobot Connection)
app.get('/', (req, res) => {
    res.status(200).send("Shahid Creatives Bot Server is Live on Render with Secured Credentials! 🚀");
});

// 🟢 ROUTE HANDLER: Client Credentials Logs Delivery
app.post('/send-client-credentials', async (req, res) => {
    try {
        const payload = req.body;
        console.log("Captured Credentials Packet via API Route:", payload);
        
        await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
            client_name: payload.name || payload.client_name || "API Inbound Portal Lead",
            whatsapp_number: payload.phone || payload.whatsapp_number || "0000000000",
            project_scope: payload.plan || payload.project_scope || "Credentials Sync Event",
            calculated_price: payload.price || payload.calculated_price || 0,
            email: payload.email || "Not Provided"
        });

        res.status(200).json({ success: true, message: "Credentials Packet routed securely to Admin Dashboard Log Framework!" });
    } catch (err) {
        console.error("Error Inside Credentials Packet Routing Engine:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 🟢 ROUTE HANDLER: Payment Reminders Dispatch Engine
app.post('/send-payment-reminder', async (req, res) => {
    try {
        const payload = req.body;
        console.log("Payment Reminder Request Received:", payload);

        const clientPhone = payload.phone || payload.whatsapp_number;
        const clientName = payload.name || payload.client_name || "Valued Client";
        const projectName = payload.plan || payload.project_scope || "Your Project Slot";
        const tokenAmount = payload.amount || "999";

        if (!clientPhone) {
            return res.status(400).json({ success: false, error: "Missing required client 'phone' parameter." });
        }

        const reminderMessage = `⚠️ *Payment Pending Reminder - Shahid Creatives* 🚀\n\nHello *${clientName}*,\n\nThis is a quick reminder regarding your slot confirmation booking for *${projectName}*.\n\nKindly complete your **₹${tokenAmount} Token Booking** slot lock parameter using your dynamic pay gateway dashboard link to avoid slot cancellation.\n\nIf you have already paid, kindly reply with 'Thanks' to update status. 👍`;

        await sendWhatsAppMessage(clientPhone, reminderMessage);

        res.status(200).json({ success: true, message: "Payment reminder notification triggered successfully!" });
    } catch (err) {
        console.error("Error Inside Payment Reminder Engine:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

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
                    const isGlobalWebsiteTemplate = rawText.includes("Global USD") || rawText.includes("Worldwide") || rawText.includes("$") || rawText.includes("Valuation: $");
                    
                    // ⚡ Reset mechanism for fallback restart
                    const resetTriggers = ['hi', 'hello', 'menu', 'start', 'hey'];
                    if (resetTriggers.includes(userText)) {
                        userSessions[from] = null;
                    }

                    if (!userSessions[from]) {
                        userSessions[from] = { 
                            step: 'region_check', 
                            lang: (isInternationalNumber || isGlobalWebsiteTemplate) ? 'EN' : 'HINGLISH', 
                            clientName: "Valued Client", 
                            clientEmail: "", 
                            projectScope: "Custom Project Development",
                            lastSubmitedTime: 0 
                        };
                    }
                    
                    if (isGlobalWebsiteTemplate) {
                        userSessions[from].lang = 'EN';
                    }

                    const userLang = userSessions[from].lang;
                    const currentStep = userSessions[from].step;

                    // 🎯 STATE -1: REGION CHECK ENGINE (FIRST STEP INBOUND INTERCEPTOR)
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

                    // 🎯 STATE 0: COURTESY REPLIES RESET BUFFER
                    if (currentStep === 'completed' || currentStep === 'post_registration') {
                        const courtesyTriggers = ['thanks', 'thank you', 'ok', 'okay', 'ji', 'shukriya', 'thx'];
                        if (courtesyTriggers.includes(userText)) {
                            userSessions[from] = null; 
                            let courtesyReply = (userLang === 'EN')
                                ? "You're most welcome! 👍 Glad to help. Type 'Menu' anytime if you want to explore again."
                                : "Aapka swagat hai! 👍 Milte hain aapse bohot jald discovery call par. Dobara shuru karne ke liye kisi bhi waqt 'Menu' ya 'Hi' bheinje.";
                            return sendWhatsAppMessage(from, courtesyReply);
                        }
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

                    // 🎯 STATE 2: DISPATCH CUSTOM QUERY & TIME TO ADMIN AND FIREBASE LOGS
                    if (currentStep === 'collect_custom_query_and_time') {
                        userSessions[from].step = 'post_registration';
                        const cleanName = userSessions[from].clientName;

                        const comprehensiveAdminAlert = `🚨 *PRE-QUALIFIED B2B CONSULTATION LEAD!* 🚨\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n📝 *Custom Time & Query:* "${rawText}"\n\n🤖 *Status:* Live details captured securely!`;
                        await sendWhatsAppMessage("917529839762", comprehensiveAdminAlert);

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: cleanName,
                                whatsapp_number: from,
                                project_scope: `Direct Consultation Slot Details: "${rawText}"`,
                                calculated_price: 0,
                                email: userSessions[from].clientEmail || "Not Provided"
                            });
                        } catch (apiErr) { 
                            console.error("Admin Panel Sync Error (State 2):", apiErr.message); 
                        }

                        let confirmationText = (userLang === 'EN')
                            ? `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Your specifications have been securely routed to Shahid. We will connect with you shortly! 🚀`
                            : `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Aapka requirement details Shahid bhai tak pahunch gaya hai. Hamari team aapse jald hi raabta karegi! 🚀`;
                        return sendWhatsAppMessage(from, confirmationText);
                    }

                    // 🎯 STATE 3: INBOUND SEQUENCE - DETAILS ACQUISITION (Fallback)
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = rawText;
                        userSessions[from].step = 'ask_name_email';
                        let replyText = (userLang === 'EN') 
                            ? "Awesome! 📝 Kindly reply with your **Full Name** and **Email Address**." 
                            : "Awesome! 📝 Kripya apna **Full Name** aur **Email ID** bhej lijiye.";
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 🎯 STATE 4: INBOUND CHAT REGISTRATION COMPLETED (UPDATED WITH EXPLICIT CURRENCY CHECK FOR LINK GENERATION)
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
                        
                        // Send Internal Trace Alert
                        const chatAdminNotification = `🌟 *NEW INBOUND CHAT LEAD!* 🌟\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n📝 *Plan Scope:* ${userSessions[from].projectScope}\n💰 *Calculated Price:* ${isUSDTrack ? '$' : '₹'}${finalPayable}`;
                        await sendWhatsAppMessage("917529839762", chatAdminNotification);

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: cleanName,
                                whatsapp_number: from,
                                project_scope: userSessions[from].projectScope,
                                calculated_price: finalPayable,
                                email: cleanEmail
                            });
                        } catch (dashboardError) {
                            console.error("Admin Dashboard Sync Failed:", dashboardError.message);
                        }

                        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                        const encodedName = encodeURIComponent(cleanName);
                        const encodedEmail = encodeURIComponent(cleanEmail);
                        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);

                        let replyText = "";
                        if (isUSDTrack) {
                            // 🚀 FIXED SYSTEMA SYNC PARAMETER: Appending currency=USD string to eliminate the portal symbol loop glitch!
                            const tokenAmountUSD = "49";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&currency=USD&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Thank you, your profile is secure! 🤝\n\n🔥 *Launch Discount Applied:* Your code **LAUNCH20** (Flat 20% OFF) is successfully linked.\n\n🔗 *Pay Securely Here:* ${selfPayLink}`;
                        } else {
                            const tokenAmountINR = "999";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&currency=INR&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Mubarak ho! Aapki requirement *${userSessions[from].projectScope}* register ho gayi hai! 🤝\n\n🔥 *Launch Discount Applied:* Coupon code **LAUNCH20** active ho gaya hai. Aap niche diye gaye link se **₹999 Token Booking** complete karke flat 20% discount slot lock karein:\n\n🔗 *Direct Pay Gateway Link:* ${selfPayLink}`;
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

                    // 🎯 STATE 5.1: NEW EXPLICIT USD PLANS AND FUZZY REQ CHECK STRINGS
                    if (currentStep === 'process_requirement_menu') {
                        let isMatchFound = false;
                        let dynamicCategory = "";
                        const isUSDTrack = (userLang === 'EN');

                        if (isUSDTrack) {
                            if (userText === '1' || userText.includes("chatbot") || userText.includes("bot")) {
                                dynamicCategory = "WhatsApp Chatbot";
                                isMatchFound = true;
                            } else if (userText === '2' || userText.includes("starter plan")) {
                                dynamicCategory = "Starter Plan";
                                isMatchFound = true;
                            } else if (userText === '3' || userText.includes("basic plan")) {
                                dynamicCategory = "Basic Plan";
                                isMatchFound = true;
                            } else if (userText === '4' || userText.includes("starter business")) {
                                dynamicCategory = "Starter Business Site";
                                isMatchFound = true;
                            } else if (userText === '5' || userText.includes("e-commerce hub") || userText.includes("ecommerce")) {
                                dynamicCategory = "E-Commerce Hub";
                                isMatchFound = true;
                            } else if (userText === '6' || userText.includes("custom enterprise") || userText.includes("enterprise app")) {
                                dynamicCategory = "Custom Enterprise App";
                                isMatchFound = true;
                            }
                        } else {
                            // Legacy Local Domestic Parsing Strings
                            if (userText === '1' || userText === 'ai' || userText.includes("chatbot") || userText.includes("bot")) {
                                dynamicCategory = "WhatsApp AI Chatbot & Automation";
                                isMatchFound = true;
                            } else if (userText === '2' || userText.includes("landing") || userText.includes("funnel")) {
                                dynamicCategory = "Landing Page/Funnel (Single Page Lead Gen)";
                                isMatchFound = true;
                            } else if (userText === '3' || userText.includes("business") || userText.includes("corporate")) {
                                dynamicCategory = "Business/Corporate Website (Brand Showcase)";
                                isMatchFound = true;
                            } else if (userText === '4' || userText.includes("e-commerce") || userText.includes("ecommerce") || userText.includes("store")) {
                                dynamicCategory = "E-commerce Website (Online Store)";
                                isMatchFound = true;
                            } else if (userText === '5' || userText.includes("software") || userText.includes("app") || userText.includes("custom web")) {
                                dynamicCategory = "Custom Web Application / Software";
                                isMatchFound = true;
                            }
                        }

                        if (isMatchFound) {
                            userSessions[from].step = 'ask_name_email';
                            userSessions[from].projectScope = dynamicCategory;

                            let askDetailsText = isUSDTrack
                                ? `Awesome! Selected: *${dynamicCategory}*. 📝 Kindly reply with your **Full Name** and **Email Address** to construct your quote profile.`
                                : `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bhej lijiye taaki aapka profile safe ho sake.`;
                            return sendWhatsAppMessage(from, askDetailsText);
                        } else {
                            let fallbackMsg = isUSDTrack
                                ? "❌ Invalid choice. Please reply with a valid layout number from *1 to 6* or exact category name."
                                : "❌ Samajh nahi paye. Kripya list mein se sahi package ka naam likhein ya fir ek number (*1 se 5*) bheinje.";
                            return sendWhatsAppMessage(from, fallbackMsg);
                        }
                    }

                    // 🎯 STATE 5.2: PROCESS AUTOMATION REQ SELECTION
                    if (currentStep === 'process_automation_menu') {
                        let isAutomateMatch = false;
                        let dynamicCategory = "";

                        if (userText === '1' || userText.includes("bot") || userText.includes("sync") || userText.includes("ai")) {
                            dynamicCategory = "WhatsApp AI Chatbot & Lead Sync";
                            isAutomateMatch = true;
                        } else if (userText === '2' || userText.includes("crm") || userText.includes("workflow")) {
                            dynamicCategory = "Custom CRM Workflow Hub";
                            isAutomateMatch = true;
                        } else if (userText === '3' || userText.includes("enterprise") || userText.includes("suite")) {
                            dynamicCategory = "Enterprise AI Suite (Tailored Architecture)";
                            isAutomateMatch = true;
                        }

                        if (isAutomateMatch) {
                            userSessions[from].step = 'ask_name_email';
                            userSessions[from].projectScope = dynamicCategory;

                            let askDetailsText = (userLang === 'EN')
                                ? `Excellent Selection: *${dynamicCategory}*. 🤖 📝 Kindly reply with your **Full Name** and **Email Address** to proceed.`
                                : `Excellent Selection! Aapne *${dynamicCategory}* choose kiya hai. 🤖 📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bheinje taaki aapka discount tracking slot link kiya ja sake.`;
                            return sendWhatsAppMessage(from, askDetailsText);
                        } else {
                            let fallbackMsg = (userLang === 'EN')
                                ? "❌ Invalid selection. Please reply with a valid number from *1 to 3* or suite category name."
                                : "❌ Kripya list mein se sirf *1, 2 ya 3* hi likhein ya category module ka naam reply karein.";
                            return sendWhatsAppMessage(from, fallbackMsg);
                        }
                    }

                    // 🎯 STATE 6: CONSULTATION FIXED SLOTS ROUTING (A, B, C)
                    if (currentStep === 'awaiting_consultation_slot') {
                        if (userText === 'a' || userText.includes("today") || userText.includes("aaj") || userText.includes("5")) {
                            userSessions[from].step = 'collect_consultation_identity'; 
                            userSessions[from].projectScope = "Direct Consultation Slot: Today at 5:00 PM";
                            await sendWhatsAppMessage("917529839762", `🚨 *SLOT REQUEST!* 🚨\n📱 +${from}\n⏰ Chosen Slot: Today at 5:00 PM`);
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✍️ *Please complete your profile:* Kindly reply with your *Full Name and Email Address*." : "✍️ *Apna profile register karein:* Kripya apna *Full Name* aur *Email ID* reply mein bhejien.");
                        } else if (userText === 'b' || userText.includes("tomorrow") || userText.includes("kal") || userText.includes("12")) {
                            userSessions[from].step = 'collect_consultation_identity'; 
                            userSessions[from].projectScope = "Direct Consultation Slot: Tomorrow at 12:00 PM";
                            await sendWhatsAppMessage("917529839762", `🚨 *SLOT REQUEST!* 🚨\n📱 +${from}\n⏰ Chosen Slot: Tomorrow at 12:00 PM`);
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✍️ *Please complete your profile:* Kindly reply with your *Full Name and Email Address*." : "✍️ *Apna profile register karein:* Kripya apna *Full Name* aur *Email ID* reply mein bhejien.");
                        } else if (userText === 'c' || userText.includes("custom") || userText.includes("time") || userText.includes("mere")) {
                            userSessions[from].step = 'collect_consultation_identity';
                            userSessions[from].projectScope = "Direct Consultation Slot: Custom Time Input Required";
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✍️ *Please complete your profile:* Kindly reply with your *Full Name and Email Address*." : "✍️ *Apna profile register karein:* Kripya apna *Full Name* aur *Email ID* reply mein bhejien.");
                        }
                    }

                    // 🎯 STATE 7: META ADS INTAKE AD-SET INTERCEPTOR
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate") || rawText.includes("Valuation: $")) {
                        if (userSessions[from].lastSubmitedTime && (Date.now() - userSessions[from].lastSubmitedTime < 60000)) { return; }
                        userSessions[from].lastSubmitedTime = Date.now();

                        let clientName = "Valued Client";
                        let clientEmail = "";
                        let projectScope = "Website Custom Estimate";
                        let parsedBasePrice = "110"; 
                        
                        try {
                            const nameMatch = rawText.match(/(?:Client Name|👤[^:]*):\s*([^\n\r]+)/i);
                            const scopeMatch = rawText.match(/(?:Category Model|Model|Specifications[^:]*):\s*([^\n\r]+)/i);
                            const priceMatch = rawText.match(/(?:Base Price|Price|Valuation[^:]*):\s*([^\n\r]+)/i);
                            
                            if (nameMatch) clientName = nameMatch[1].split('\n')[0].split(',')[0].trim();
                            if (scopeMatch) projectScope = scopeMatch[1].replace(/[\*•\-]/g, '').trim();
                            if (priceMatch) parsedBasePrice = priceMatch[1].replace(/[^0-9.]/g, '').trim();
                            
                            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                            const emailMatch = rawText.match(globalEmailRegex);
                            if (emailMatch) clientEmail = emailMatch[1].trim();
                        } catch (parseError) { console.error("Parser failure exception."); }

                        userSessions[from].clientName = clientName;
                        userSessions[from].clientEmail = clientEmail;
                        userSessions[from].projectScope = projectScope;
                        userSessions[from].step = 'awaiting_website_action';
                        
                        const isUSDTrack = (isGlobalWebsiteTemplate || rawText.includes("$"));
                        userSessions[from].lang = isUSDTrack ? 'EN' : 'HINGLISH';

                        const calculatedPrice = calculateTotalPayable(parsedBasePrice, isUSDTrack);

                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail || 'Not Provided'}\n📝 *Plan Chosen:* ${projectScope}\n💰 *Base Valuation:* ${isUSDTrack ? '$' : '₹'}${calculatedPrice}`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: clientName,
                                whatsapp_number: from,
                                project_scope: projectScope,
                                calculated_price: calculatedPrice,
                                email: clientEmail
                            });
                        } catch (err) { console.error("Meta Intake Dashboard sync err:", err.message); }

                        let clientReply = (userSessions[from].lang === 'EN')
                            ? `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved.\n\n🔥 *Exclusive Reward Activated:* Launch code **LAUNCH20** secures a **Flat 20% OFF** discount!\n\nPlease reply with your choice number:\n\n1️⃣ **Book Token (Confirm Slot & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Schedule Strategy Call)**`
                            : `Thank you *${clientName}*! 🙏 Aapka data server par secure ho gaya hai.\n\n🔥 *Exclusive Offer Activated:* Coupon code **LAUNCH20** (Flat 20% OFF) active ho gaya hai!\n\nNiche diye gaye number se reply kijiye:\n\n1️⃣ **Token Book Karein (Slot Confirm & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Strategy Call)**`;
                        
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    // 🎯 STATE 8: CORE ENGINE - HYBRID GLOBAL PARSER
                    if (currentStep === 'welcome' || currentStep === 'main_menu') {
                        userSessions[from].step = 'main_menu';
                        
                        let isCoreMatch = false;
                        let targetMenuRoute = userText;

                        if (userText === '1' || userText.includes("web") || userText.includes("dev") || userText.includes("site") || userText.includes("website") || userText.includes("package") || userText.includes("custom") || userText.includes("standard")) {
                            targetMenuRoute = '1';
                            isCoreMatch = true;
                        } else if (userText === '2' || userText.includes("automation") || userText.includes("bot") || userText.includes("demo") || userText.includes("crm")) {
                            targetMenuRoute = '2';
                            isCoreMatch = true;
                        } else if (userText === '3' || userText.includes("deal") || userText.includes("launch") || userText.includes("offer") || userText.includes("discount") || userText.includes("flat") || userText.includes("20%") || userText.includes("off") || userText.includes("coupon")) {
                            targetMenuRoute = '3';
                            isCoreMatch = true;
                        } else if (userText === '4' || userText.includes("book") || userText.includes("token") || userText.includes("payment") || userText.includes("razorpay")) {
                            targetMenuRoute = '4';
                            isCoreMatch = true;
                        } else if (userText === '5' || userText.includes("shahid") || userText.includes("talk") || userText.includes("consultation") || userText.includes("direct")) {
                            targetMenuRoute = '5';
                            isCoreMatch = true;
                        }

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
