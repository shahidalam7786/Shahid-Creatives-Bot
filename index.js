const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// 🟢 LIGHTWEIGHT IN-MEMORY STORAGE (Render Safe Ecosystem)
const userSessions = {};

// 📈 DYNAMIC PRICING LEDGER MAPPING WITH +3.5% GATEWAY FEES FOR USD / +18% GST FOR INR
function calculateTotalPayable(basePrice, isUSD = false) {
    const cleanBase = parseFloat(basePrice.toString().replace(/[^0-9.]/g, ''));
    if (isNaN(cleanBase)) {
        return 0;
    }
    
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
        // 🚀 AI Automation Plans (Placed FIRST to strictly prevent overlap with Web Plans)
        if (text.includes("ai content") || text.includes("seo maintainer")) {
            return "77";
        }
        if (text.includes("b2b") || text.includes("wholesale lead")) {
            return "155";
        }
        if (text.includes("service & appointment") || text.includes("appointment lead")) {
            return "155";
        }
        if (text.includes("e-commerce sales automation") || text.includes("automation retainer")) {
            return "155";
        }
        if (text.includes("complete digital sales") || text.includes("digital sales engine")) {
            return "311";
        }
        
        // 🌐 Web Plans
        if (text.includes("starter plan") || text.includes("visiting card") || text.includes("starter / visiting card site")) {
            return "199";
        }
        if (text.includes("basic plan") || text.includes("landing page")) {
            return "299";
        }
        if (text.includes("starter business") || text.includes("business website")) {
            return "499";
        }
        if (text.includes("e-commerce hub") || text.includes("ecommerce")) {
            return "899";
        }
        if (text.includes("custom enterprise") || text.includes("software")) {
            return "2499";
        }
        
        return "110";
    } else {
        // 🚀 AI Automation Plans (Placed FIRST to strictly prevent overlap with Web Plans)
        if (text.includes("ai content") || text.includes("seo maintainer")) {
            return "4999";
        }
        if (text.includes("b2b") || text.includes("wholesale lead")) {
            return "9499";
        }
        if (text.includes("service & appointment") || text.includes("appointment lead")) {
            return "9499";
        }
        if (text.includes("e-commerce sales automation") || text.includes("automation retainer")) {
            return "9499";
        }
        if (text.includes("complete digital sales") || text.includes("digital sales engine")) {
            return "18999";
        }
        
        // 🌐 Web Plans
        if (text.includes("landing page") || text.includes("funnel")) {
            return "12300";
        }
        if (text.includes("business") || text.includes("corporate")) {
            return "25500";
        }
        if (text.includes("e-commerce") || text.includes("store")) {
            return "47500";
        }
        if (text.includes("saas") || text.includes("software") || text.includes("custom web application")) {
            return "145000";
        }
        
        return "8713"; 
    }
}

// 🤖 BACKGROUND TIMEOUT ENGINE: 10-Minute Automated Nudge Follow-up
setInterval(() => {
    const now = Date.now();
    for (const from in userSessions) {
        const session = userSessions[from];
        if (session && session.step !== 'completed' && session.step !== 'post_registration' && session.step !== 'awaiting_custom_time_input' && (now - session.lastInteractionTime > 600000) && !session.nudgeSent) {
            const nudgeMessage = (session.lang === 'EN')
                ? "Hi! I noticed you were exploring our premium development options. Do you have any questions or need help locking in your slot? 😊"
                : "Hi! Maine dekha aap Shahid Creatives ki services explore kar rahe the. Kya aapko koi sawal hai ya coupon lock karne me koi help chahiye? 😊";
            
            // Switch state status securely to wait for reply handles
            session.step = 'nudge_sent_waiting_reply';
            sendWhatsAppMessage(from, nudgeMessage);
            session.nudgeSent = true; 
        }
    }
}, 60000);

// 🤖 SERVER HEALTH CHECK
app.get('/', (req, res) => {
    res.status(200).send("Shahid Creatives Bot Server is Live on Render with Secured Credentials! 🚀");
});

// 🟢 ROUTE HANDLER: Client Credentials Logs Delivery & Admin Alert Sync
app.post('/send-client-credentials', async (req, res) => {
    try {
        const payload = req.body;
        
        // Admin Alert for API Inbound Event
        const adminAlertText = `🌟 *NEW API PORTAL LEAD!* 🌟\n\n👤 *Name:* ${payload.name || payload.client_name || "Unknown"}\n📱 *Phone:* ${payload.phone || payload.whatsapp_number || "0000"}\n✉️ *Email:* ${payload.email || "Not Provided"}\n📝 *Plan:* ${payload.plan || payload.project_scope || "N/A"}\n💰 *Price Calculated:* ${payload.price || payload.calculated_price || 0}`;
        await sendWhatsAppMessage("917529839762", adminAlertText);

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
        if (!clientPhone) {
            return res.status(400).json({ success: false, error: "Missing number" });
        }

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

                    const resetTriggers = ['hi', 'hello', 'menu', 'start', 'hey'];
                    if (resetTriggers.includes(userText)) { 
                        userSessions[from] = null; 
                    }

                    // 🎯 TOP PRIORITY INTERCEPTOR: WEBSITE INBOUND FORM SYNC
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate") || rawText.includes("Estimated Price:") || rawText.includes("Grand Total:") || rawText.includes("Project/Category:")) {
                        if (userSessions[from] && userSessions[from].lastSubmitedTime && (Date.now() - userSessions[from].lastSubmitedTime < 15000)) { 
                            return; 
                        }
                        
                        let clientName = "Valued Client"; 
                        let clientEmail = "Not Provided"; 
                        let projectScope = "Website Custom Estimate"; 
                        let parsedBasePrice = 0; 
                        
                        try {
                            const nameMatch = rawText.match(/(?:Client Name|👤[^:]*):\s*([^\n\r]+)/i);
                            // Robust scope match supporting multiple dynamic labels
                            const scopeMatch = rawText.match(/(?:Project\/Category|Category Model|Plan Chosen|Specifications)[^:]*:\s*([^\n\r]+)/i);
                            
                            if (nameMatch) {
                                clientName = nameMatch[1].split(',')[0].trim();
                            }
                            if (scopeMatch) {
                                projectScope = scopeMatch[1].replace(/[\*•]/g, '').trim();
                            }
                            
                            // Highly precise absolute total extraction from website
                            const totalMatch = rawText.match(/(?:Total Due|Grand Total)[^₹$]*[₹$]\s*([0-9.,]+)/i);
                            if (totalMatch) {
                                parsedBasePrice = Math.round(parseFloat(totalMatch[1].replace(/,/g, '')));
                            } else {
                                // Fallback: extract the last valid currency number (usually the grand total on receipts)
                                const allPrices = [...rawText.matchAll(/[₹$]\s*([0-9.,]+)/g)];
                                if (allPrices.length > 0) {
                                    parsedBasePrice = Math.round(parseFloat(allPrices[allPrices.length - 1][1].replace(/,/g, '')));
                                }
                            }
                            
                            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                            const emailMatch = rawText.match(globalEmailRegex);
                            if (emailMatch) {
                                clientEmail = emailMatch[1].trim();
                            }
                        } catch (parseError) { 
                            console.error("Parser failure exception inside landing template."); 
                        }

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
                            
                            const paidAdminAlert = `✅ *PAID CLIENT REGISTERED!* ✅\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail}\n📝 *Plan Scope:* ${projectScope}\n💳 *Status:* Fully Paid via Portal Gateway!`;
                            await sendWhatsAppMessage("917529839762", paidAdminAlert);

                            try {
                                await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                                    client_name: clientName, 
                                    whatsapp_number: from, 
                                    project_scope: `${projectScope} (Status: Fully Paid Portal Form)`, 
                                    calculated_price: parsedBasePrice, 
                                    email: clientEmail 
                                });
                            } catch (err) { 
                                console.error("Paid lead API sync error:", err.message); 
                            }
                            
                            let paidSuccessReply = (userSessions[from].lang === 'EN')
                                ? `Thank you *${clientName}*! 🙏 Your paid booking has been successfully verified on our dashboard.\n\n⚡ *Status:* **Project Consultation Stage Activated!**`
                                : `Mubarak ho *${clientName}*! 🙏 Aapki payment received data hamare dashboard par successfully sync ho gayi hai.\n\n⚡ *Status:* **Project Consultation Stage Active!**`;
                            return sendWhatsAppMessage(from, paidSuccessReply);
                        }

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
                        
                        // Strict direct assignment. Never modifies pre-calculated website values.
                        const calculatedPrice = parsedBasePrice; 
                        const isINRLead = rawText.includes('₹') || rawText.includes('inr') || rawText.includes('INR') || !isInternationalNumber;
                        const currencyAdmin = isINRLead ? '₹' : '$';

                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* +${from}\n👤 *Name:* ${clientName}\n📝 *Plan:* ${projectScope}\n💰 *Total Value:* ${currencyAdmin}${calculatedPrice}`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                                client_name: clientName, 
                                whatsapp_number: from, 
                                project_scope: projectScope, 
                                calculated_price: calculatedPrice, 
                                email: clientEmail 
                            });
                        } catch (err) { 
                            console.error("Meta Dashboard sync err."); 
                        }

                        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                        const tokenAmount = isINRLead ? 999 : 49;
                        const tokenCurrency = isINRLead ? 'INR' : 'USD';
                        const guaranteeText = isINRLead ? 'INR Slot Guarantee' : 'USD Slot Guarantee';

                        const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmount}&currency=${tokenCurrency}&totalPrice=${calculatedPrice}&name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail)}&phone=${from}&plan=${encodeURIComponent(projectScope)}&coupon=LAUNCH20`;

                        let clientReply = `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved to our dashboard.\n\n🔗 *Pay Securely Here (${guaranteeText}):* ${selfPayLink}`;
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    if (!userSessions[from]) {
                        userSessions[from] = { 
                            step: 'region_check', 
                            lang: (isInternationalNumber || isGlobalWebsiteTemplate) ? 'EN' : 'HINGLISH', 
                            clientName: "Valued Client", 
                            clientEmail: "", 
                            projectScope: "Custom Project Development", 
                            requestedSlot: "Not Selected", 
                            lastSubmitedTime: 0, 
                            lastInteractionTime: Date.now(), 
                            nudgeSent: false 
                        };
                    }
                    
                    userSessions[from].lastInteractionTime = Date.now();
                    const userLang = userSessions[from].lang;
                    const currentStep = userSessions[from].step;

                    const courtesyTriggers = ['thanks', 'thank you', 'ok', 'okay', 'ji', 'shukriya', 'thx'];
                    if (courtesyTriggers.includes(userText)) {
                        userSessions[from] = null; 
                        let courtesyReply = (userLang === 'EN')
                            ? "You're most welcome! 👍 Glad to help. Type 'Menu' anytime if you want to explore again."
                            : "Aapka swagat hai! 👍 Milte hain aapse bohot jald discovery call par. Dobara shuru karne ke liye kisi bhi waqt 'Menu' ya 'Hi' bheinje.";
                        return sendWhatsAppMessage(from, courtesyReply);
                    }

                    // 🎯 HIGH-PRIORITY INTERCEPTOR STATE: HANDLING USER REPLIES TO AUTOMATED FOLLOW-UP NUDGES
                    if (currentStep === 'nudge_sent_waiting_reply') {
                        const positiveTriggers = ['yes', 'yeah', 'yup', 'haan', 'ji', 'help', 'ok', 'okay', 'sure', 'help chahiye', 'bataiye'];
                        if (positiveTriggers.includes(userText) || userText.length >= 2) {
                            userSessions[from].step = 'awaiting_consultation_slot';
                            const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
                            
                            const optionA = (currentHourIST >= 17) ? "A) *Kal Shaam 5:00 Baje*" : "A) *Aaj Shaam 5:00 Baje*";
                            const optionB = (currentHourIST >= 17) ? "B) *Parso Dopahar 12:00 Baje*" : "B) *Kal Dopahar 12:00 Baje*";
                            const optionA_EN = (currentHourIST >= 17) ? "A) *Tomorrow at 5:00 PM*" : "A) *Today at 5:00 PM*";
                            const optionB_EN = (currentHourIST >= 17) ? "B) *Day After Tomorrow at 12:00 PM*" : "B) *Tomorrow at 12:00 PM*";

                            let nudgeResponse = (userLang === 'EN')
                                ? `Awesome! Let's get you connected for a free strategy call. Please choose your slot:\n\n${optionA_EN}\n${optionB_EN}\nC) *Custom Time (Type preferred time below)*\n\n👉 Reply with A, B, or C!`
                                : `Ji bilkul! Aaiye aapka free consulting strategy slot lock kar dete hain. Kripya niche se ek option choose karein:\n\n${optionA}\n${optionB}\nC) *Custom Time (Apna secure timing niche type karein)*\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye!`;
                            return sendWhatsAppMessage(from, nudgeResponse);
                        }
                    }

                    // 🎯 STATE -1: REGION CHECK ENGINE
                    if (currentStep === 'region_check') {
                        let processedRoute = false;
                        if (userText === '1' || userText.includes("india") || userText.includes("inr")) { 
                            userSessions[from].lang = 'HINGLISH'; 
                            userSessions[from].step = 'main_menu'; 
                            processedRoute = true; 
                        } else if (userText === '2' || userText.includes("outside") || userText.includes("usd") || isInternationalNumber) { 
                            userSessions[from].lang = 'EN'; 
                            userSessions[from].step = 'main_menu'; 
                            processedRoute = true; 
                        }

                        if (processedRoute) {
                            let replyText = (userSessions[from].lang === 'EN')
                                ? "Hello! Welcome to *Shahid Creatives*. 🚀\nSelect a professional stack tier via option number:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation Hub**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid (Direct Consultation)**"
                                : "Hello! Welcome to *Shahid Creatives*. 🚀\nKoshish ko aage badhane ke liye ek option number reply kijiye:\n\n1️⃣ *Web Development Tiers*\n2️⃣ *AI Business Automation & B2B Wholesale Demo*\n3️⃣ *🔥 Exclusive Launch Deal*\n4️⃣ *💳 Direct Booking & Token System*\n5️⃣ *👤 Talk to Shahid* (Direct Consultation)";
                            return sendWhatsAppMessage(from, replyText);
                        } else {
                            return sendWhatsAppMessage(from, "Welcome to *Shahid Creatives*! 🚀 Please select your location layout to proceed:\n\n1️⃣ **India (Tax/Billing: ₹ INR)**\n2️⃣ **Outside India (Global Billing: $ USD)**");
                        }
                    }

                    // 🎯 DEDICATED CAPTURE ROUTE FOR CUSTOM SCHEDULING TEXT
                    if (currentStep === 'awaiting_custom_time_input') {
                        let cleanInputTime = userText.replace(/[cCc🅲🅲️\-\*•\(\)]/g, '').trim();
                        userSessions[from].step = 'collect_consultation_identity';
                        userSessions[from].requestedSlot = rawText; 
                        userSessions[from].projectScope = `Custom Slot Input ("${rawText}")`;
                        return sendWhatsAppMessage(from, (userLang === 'EN') 
                            ? `Got it! Custom slot parameters recorded: *"${rawText}"*\n\n✍ *Please complete your profile:* Kindly reply with your *Full Name* and *Email Address* (separated by comma, e.g. John Doe, john@example.com).` 
                            : `Noted! Aapka preferred date/time save ho gaya hai: *"${rawText}"*\n\n✍ *Apna profile register karein:* Kripya reply mein apna *Full Name* aur *Email ID* comma (,) lagakar bheinjein (jaise: Sarfaraj Khan, sarfaraj@example.com).`);
                    }

                    // 🎯 STATE 1: COLLECT IDENTITY (STRICT MANDATORY NAME & EMAIL CHECK)
                    if (currentStep === 'collect_consultation_identity') {
                        let cleanName = ""; 
                        let cleanEmail = "";
                        if (rawText.includes(",")) {
                            const parts = rawText.split(","); 
                            cleanName = parts[0].trim(); 
                            cleanEmail = parts[1].trim();
                        } else {
                            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                            const emailMatch = rawText.match(globalEmailRegex);
                            if (emailMatch) { 
                                cleanEmail = emailMatch[1].trim(); 
                                cleanName = rawText.replace(emailMatch[0], "").replace(/[,]/g, "").trim(); 
                            }
                        }

                        if (!cleanName || cleanName.length < 2 || !cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
                            return sendWhatsAppMessage(from, (userLang === 'EN') 
                                ? "⚠️ *Format Error!* Both **Full Name** and a valid **Email ID** are strictly mandatory.\n\n👉 Please reply again in this exact structure: *Your Name, your-email@example.com*" 
                                : "⚠️ *Registration Error!* Profile lock karne ke liye **Full Name** aur ek valid **Email ID** dono zaroori hain.\n\n👉 Kripya dubara is tarah likh kar bhejin: *Aapka Name, aapkaemail@gmail.com*");
                        }
                        
                        userSessions[from].step = 'collect_custom_query_and_time'; 
                        userSessions[from].clientName = cleanName; 
                        userSessions[from].clientEmail = cleanEmail;

                        let descriptivePrompt = (userLang === 'EN')
                            ? `Thank you *${cleanName}*! 🙏\n\nTo lock a high-converting strategy blueprint, please share your goals in the next reply:\n\n🌐 **1. Website Development:**\nWhich plan fits your vision? (Starter Plan, Basic Plan, Starter Business Site, or E-Commerce Hub?)\n\n🤖 **2. AI Automation Goals:**\nWhat precise processes do you want to automate?`
                            : `Thank you *${cleanName}*! 🙏\n\nStrategy call ko 100% efficient banane ke liye, kripya agle message mein niche di gayi details batayein:\n\n🌐 **Type 1:** Agar aapko Website chahiye toh specific type likhein (e.g., Landing Page, Corporate Showcase, ya Online Store).\n\n🤖 **Type 2:** Agar AI Architecture/Bot chahiye toh details likhein (e.g., AI SEO, WhatsApp Lead Bot, Sales Engine).`;
                        return sendWhatsAppMessage(from, descriptivePrompt);
                    }

                    // 🎯 STATE 2: INTERCEPTOR FOR SELECTIONS (1 OR 2 VALIDATION ENGINE)
                    if (currentStep === 'collect_custom_query_and_time') {
                        const isUSDTrack = (userLang === 'EN');

                        if (userText === '1' || userText === '2' || userText === 'type 1' || userText === 'type 2') {
                            userSessions[from].step = 'awaiting_specific_service_selection';
                            
                            let interceptorReply = (userText.includes('1'))
                                ? (isUSDTrack ? "⚠️ Please be specific! Which Web scope do you need? \n\n👉 Type one: *Starter Plan* ($199), *Basic Plan* ($299), *Starter Business Site* ($499), or *E-Commerce Hub* ($899)" : "⚠️ Kripya clear batayein! Aapko hamare active modules mein se kis tarah ki website chahiye? \n\n👉 Niche diye gaye active plans mein se ek naam type karein:\n🔹 *Landing Page/Funnel* (₹12,300)\n🔹 *Business/Corporate Website* (₹25,500)\n🔹 *E-commerce Website (Online Store)* (₹47,500)\n🔹 *Custom Web Application* (₹1,45,000+)")
                                : (isUSDTrack ? "⚠️ Please be specific! What AI architecture do you want? \n\n👉 Type one: *AI Content & SEO* ($77), *B2B & Wholesale* ($155), *Service Lead* ($155), *E-Commerce Sales* ($155), or *Complete Digital Engine* ($311)" : "⚠️ Kripya clear batayein! Aapko kis tarah ka automation stack design karwana hai? \n\n👉 Niche diye gaye models mein se ek naam type karein:\n🤖 *AI Content & SEO Maintainer* (₹4,999/Mo)\n💼 *B2B & Wholesale Lead Engine* (₹9,499/Mo)\n📅 *Service & Appointment Lead* (₹9,499/Mo)\n🛒 *E-Commerce Sales Automation* (₹9,499/Mo)\n🌐 *Complete Digital Sales Engine* (₹18,999/Mo)");
                            return sendWhatsAppMessage(from, interceptorReply);
                        }

                        userSessions[from].step = 'post_registration';
                        return finalizeConsultationLead(from, rawText, res);
                    }

                    // 🎯 STATE 2.1: FINAL DISPATCH AFTER SUB-MENU SELECTION
                    if (currentStep === 'awaiting_specific_service_selection') {
                        userSessions[from].step = 'post_registration';
                        return finalizeConsultationLead(from, rawText, res);
                    }

                    // 🎯 STATE 3: INBOUND SEQUENCE (Fallback)
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = rawText; 
                        userSessions[from].step = 'ask_name_email';
                        return sendWhatsAppMessage(from, (userLang === 'EN') ? "Awesome! 📝 Kindly reply with your **Full Name** and **Email Address**." : "Awesome! 📝 Kripya apna **Full Name** aur **Email ID** bhej lijiye.");
                    }

                    // 🎯 STATE 4: INBOUND CHAT REGISTRATION COMPLETED
                    if (currentStep === 'ask_name_email') {
                        let cleanName = ""; 
                        let cleanEmail = "";
                        
                        if (rawText.includes(",")) {
                            const parts = rawText.split(","); 
                            cleanName = parts[0].trim(); 
                            cleanEmail = parts[1].trim();
                        } else {
                            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                            const emailMatch = rawText.match(globalEmailRegex);
                            if (emailMatch) { 
                                cleanEmail = emailMatch[1].trim(); 
                                cleanName = rawText.replace(emailMatch[0], "").replace(/[,]/g, "").trim(); 
                            }
                        }

                        if (!cleanName || cleanName.length < 2 || !cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
                            return sendWhatsAppMessage(from, (userLang === 'EN') 
                                ? "⚠️ *Format Error!* Both **Full Name** and a valid **Email ID** are strictly mandatory to generate the payment token.\n\n👉 Please reply again in this exact structure: *Your Name, your-email@example.com*" 
                                : "⚠️ *Registration Error!* Link generate karne ke liye **Full Name** aur ek valid **Email ID** dono zaroori hain.\n\n👉 Kripya dubara is tarah likh kar bhejin: *Aapka Name, aapkaemail@gmail.com*");
                        }

                        userSessions[from].step = 'completed'; 
                        userSessions[from].clientName = cleanName; 
                        userSessions[from].clientEmail = cleanEmail;
                        
                        const isUSDTrack = (userLang === 'EN');
                        const matchedBasePrice = getBasePriceByPlan(userSessions[from].projectScope, isUSDTrack);
                        const finalPayable = calculateTotalPayable(matchedBasePrice, isUSDTrack);
                        
                        const currencySymbol = isUSDTrack ? '$' : '₹';
                        const taxLabel = isUSDTrack ? 'incl Gateway Fees' : 'incl GST';

                        // Admin Notification Fix
                        const chatAdminNotification = `🌟 *NEW INBOUND CHAT LEAD!* 🌟\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n✉️ *Email:* ${cleanEmail}\n📝 *Plan Scope:* ${userSessions[from].projectScope}\n💰 *Calculated Price (${taxLabel}):* ${currencySymbol}${finalPayable}`;
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
                            console.error("Admin Sync exception logic execution handler."); 
                        }

                        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                        const encodedName = encodeURIComponent(cleanName); 
                        const encodedEmail = encodeURIComponent(cleanEmail); 
                        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);

                        let replyText = isUSDTrack 
                            ? `🎉 *Success!* Your requirement for *${userSessions[from].projectScope}* is formally registered.\n\n*Next Steps:*\nTo initiate your project development slot, please process the standard booking token ($49 USD) via our secure gateway below:\n\n🔗 *Secure Checkout Portal:* https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=49&currency=USD&totalPrice=${finalPayable}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20\n\n_Note: Shahid's core team will reach out immediately upon confirmation!_`
                            : `🎉 *Mubarak ho!* Aapki requirement (*${userSessions[from].projectScope}*) successfully hamare dashboard mein register ho gayi hai.\n\n*Next Steps:*\nApna slot pakka karne aur project shuru karne ke liye kripya apna Token Amount (₹999 INR) niche diye gaye secure payment link par clear karein:\n\n🔗 *Secure Checkout Portal:* https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=999&currency=INR&totalPrice=${finalPayable}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20\n\n_Note: Payment verify hote hi Shahid bhai ki team seedha aapse sampark karegi!_`;
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 🎯 STATE 5: INTERCEPTING MENU CHOICES FOR WEBSITE ACTION
                    if (currentStep === 'awaiting_website_action') {
                        if (userText === '1' || userText.includes("token") || userText.includes("book") || userText.includes("confirm")) {
                            userSessions[from].step = 'process_requirement_menu';
                            let requirementPrompt = (userLang === 'EN')
                                ? "Please select what you want to build today by replying with the option number (**1 to 5**):\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Custom Enterprise App ($2,499)"
                                : "Perfect! Pehle aapki structural requirement lock kar lete hain. 🚀\n\nNiche diye gaye options mein se koi ek number (*1 se 4*) reply kijiye:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)";
                            return sendWhatsAppMessage(from, requirementPrompt);
                        } else if (userText === '2' || userText.includes("discuss") || userText.includes("call") || userText.includes("strategy")) {
                            userSessions[from].step = 'post_registration';
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "👤 Perfect! Shahid will connect with you shortly for a strategy sync call." : "👤 Perfect! Shahid bhai bohot jald aapke sath strategy call par connect karenge. Get ready to launch! 🚀");
                        }
                    }

                    // 🎯 STATE 5.1: PROCESSOR FOR SUB-MENU (WEB DEVP)
                    if (currentStep === 'process_requirement_menu') {
                        let isMatchFound = false; 
                        let dynamicCategory = ""; 
                        const isUSDTrack = (userLang === 'EN');

                        if (isUSDTrack) {
                            if (userText === '1' || userText.includes("starter plan")) { dynamicCategory = "Starter Plan"; isMatchFound = true; }
                            else if (userText === '2' || userText.includes("basic plan")) { dynamicCategory = "Basic Plan"; isMatchFound = true; }
                            else if (userText === '3' || userText.includes("starter business")) { dynamicCategory = "Starter Business Site"; isMatchFound = true; }
                            else if (userText === '4' || userText.includes("e-commerce hub")) { dynamicCategory = "E-Commerce Hub"; isMatchFound = true; }
                            else if (userText === '5' || userText.includes("custom enterprise")) { dynamicCategory = "Custom Enterprise App"; isMatchFound = true; }
                        } else {
                            if (userText === '1' || userText.includes("landing")) { dynamicCategory = "Landing Page/Funnel (Single Page Lead Gen)"; isMatchFound = true; }
                            else if (userText === '2' || userText.includes("business")) { dynamicCategory = "Business/Corporate Website (Brand Showcase)"; isMatchFound = true; }
                            else if (userText === '3' || userText.includes("e-commerce")) { dynamicCategory = "E-commerce Website (Online Store)"; isMatchFound = true; }
                            else if (userText === '4' || userText.includes("software")) { dynamicCategory = "Custom Web Application / Software"; isMatchFound = true; }
                        }

                        if (isMatchFound) {
                            userSessions[from].step = 'ask_name_email'; 
                            userSessions[from].projectScope = dynamicCategory;
                            return sendWhatsAppMessage(from, isUSDTrack ? `Awesome! Selected: *${dynamicCategory}*. 📝 Kindly reply with your **Full Name** and **Email Address**.` : `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bhej lijiye.`);
                        } else {
                            return sendWhatsAppMessage(from, isUSDTrack ? "❌ Invalid choice. Reply from valid options." : "❌ Samajh nahi paye. Kripya list mein se ek number bheinje.");
                        }
                    }

                    // 🎯 STATE 5.2: PROCESS AUTOMATION REQ SELECTION (UPDATED 5 PLANS)
                    if (currentStep === 'process_automation_menu') {
                        let isAutomateMatch = false;
                        let dynamicCategory = "";

                        if (userText === '1' || userText.includes("content") || userText.includes("seo")) { dynamicCategory = "AI Content & SEO Maintainer"; isAutomateMatch = true; }
                        else if (userText === '2' || userText.includes("b2b") || userText.includes("wholesale")) { dynamicCategory = "B2B & Wholesale Lead Engine"; isAutomateMatch = true; }
                        else if (userText === '3' || userText.includes("service") || userText.includes("appointment")) { dynamicCategory = "Service & Appointment Lead Engine"; isAutomateMatch = true; }
                        else if (userText === '4' || userText.includes("e-commerce sales") || userText.includes("retainer")) { dynamicCategory = "The E-Commerce Sales Automation Retainer"; isAutomateMatch = true; }
                        else if (userText === '5' || userText.includes("complete digital") || userText.includes("sales engine")) { dynamicCategory = "The Complete Digital Sales Engine"; isAutomateMatch = true; }

                        if (isAutomateMatch) {
                            userSessions[from].step = 'ask_name_email';
                            userSessions[from].projectScope = dynamicCategory;
                            let askDetailsText = (userLang === 'EN')
                                ? `Excellent Selection: *${dynamicCategory}*. 🤖 📝 Kindly reply with your **Full Name** and **Email Address** to proceed.`
                                : `Excellent Selection! Aapne *${dynamicCategory}* choose kiya hai. 🤖 📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bheinje.`;
                            return sendWhatsAppMessage(from, askDetailsText);
                        } else {
                            let fallbackMsg = (userLang === 'EN') ? "❌ Invalid selection. Reply from *1 to 5*." : "❌ Kripya list mein se sirf *1 se 5* ke beech koi number likhein.";
                            return sendWhatsAppMessage(from, fallbackMsg);
                        }
                    }

                    // 🎯 STATE 6: CONSULTATION FIXED SLOTS ROUTING
                    if (currentStep === 'awaiting_consultation_slot') {
                        const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
                        let chosenOptionClean = userText.replace(/[\-\*•\(\)]/g, '').trim();
                        
                        if (chosenOptionClean === 'a' || chosenOptionClean.includes("today") || chosenOptionClean.includes("5")) {
                            userSessions[from].step = 'collect_consultation_identity'; 
                            const dynamicSlotLabel = (currentHourIST >= 17) ? "Tomorrow at 5:00 PM" : "Today at 5:00 PM";
                            
                            userSessions[from].requestedSlot = dynamicSlotLabel; userSessions[from].projectScope = `Direct Consultation Slot: ${dynamicSlotLabel}`;
                            await sendWhatsAppMessage("917529839762", `🚨 *SLOT REQUEST!* 🚨\n📱 +${from}\n⏰ Chosen Slot: ${dynamicSlotLabel}`);
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✍ *Please complete your profile:* Kindly reply with your *Full Name and Email Address* (separated by a comma, e.g. John Doe, john@email.com)." : "✍ *Apna profile register karein:* Kripya apna *Full Name, Email ID* reply mein comma (,) lagakar ek sath bhejien (jaise: Sarfaraj Khan, sarfaraj@gmail.com).");
                        } else if (chosenOptionClean === 'b' || chosenOptionClean.includes("tomorrow") || chosenOptionClean.includes("12")) {
                            userSessions[from].step = 'collect_consultation_identity'; 
                            const dynamicSlotLabel = (currentHourIST >= 17) ? "Day After Tomorrow at 12:00 PM" : "Tomorrow at 12:00 PM";
                            
                            userSessions[from].requestedSlot = dynamicSlotLabel; userSessions[from].projectScope = `Direct Consultation Slot: ${dynamicSlotLabel}`;
                            await sendWhatsAppMessage("917529839762", `🚨 *SLOT REQUEST!* 🚨\n📱 +${from}\n⏰ Chosen Slot: ${dynamicSlotLabel}`);
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✍ *Please complete your profile:* Kindly reply with your *Full Name and Email Address* (separated by a comma, e.g. John Doe, john@email.com)." : "✍ *Apna profile register karein:* Kripya apna *Full Name, Email ID* reply mein comma (,) lagakar ek sath bhejien (jaise: Sarfaraj Khan, sarfaraj@gmail.com).");
                        } else if (chosenOptionClean === 'c' || chosenOptionClean.includes("custom")) {
                            userSessions[from].step = 'awaiting_custom_time_input';
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "📅 *Custom Scheduling Activated!* \n\nPlease type your preferred **Date and Time** below (e.g., *Monday at 3 PM*):" : "📅 *Custom Scheduling Active!* \n\nKripya jis **Date aur Time** par aap call chahte hain, use niche type karke send karein (jaise: *Kal dopahar 3 baje*):");
                        }
                    }

                    // 🎯 STATE 8: CORE ENGINE - MAIN MENU ROUTER
                    if (currentStep === 'welcome' || currentStep === 'main_menu') {
                        userSessions[from].step = 'main_menu';
                        let isCoreMatch = false; let targetMenuRoute = userText;

                        if (userText === '1' || userText.includes("web") || userText.includes("site")) { targetMenuRoute = '1'; isCoreMatch = true; }
                        else if (userText === '2' || userText.includes("automation") || userText.includes("bot")) { targetMenuRoute = '2'; isCoreMatch = true; }
                        else if (userText === '3' || userText.includes("deal") || userText.includes("discount")) { targetMenuRoute = '3'; isCoreMatch = true; }
                        else if (userText === '4' || userText.includes("book") || userText.includes("token")) { targetMenuRoute = '4'; isCoreMatch = true; }
                        else if (userText === '5' || userText.includes("shahid") || userText.includes("talk")) { targetMenuRoute = '5'; isCoreMatch = true; }

                        if (!isCoreMatch) {
                            let replyText = (userLang === 'EN')
                                ? "Hello! Welcome to *Shahid Creatives*. 🚀 Select a stack tier layout:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation Hub**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid (Direct Consultation)**"
                                : "Hello! Welcome to *Shahid Creatives*. 🚀 Select layout choice number:\n\n1️⃣ *Web Development Tiers*\n2️⃣ *AI Business Automation & B2B Wholesale Demo*\n3️⃣ *🔥 Exclusive Launch Deal*\n4️⃣ *💳 Direct Booking & Token System*\n5️⃣ *👤 Talk to Shahid* (Direct Consultation)";
                            return sendWhatsAppMessage(from, replyText);
                        }

                        if (targetMenuRoute === '1') {
                            userSessions[from].step = 'process_requirement_menu'; 
                            return sendWhatsAppMessage(from, (userLang === 'EN') 
                                ? "Please select what you want to build today by replying with option number:\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Custom Enterprise App ($2,499)" 
                                : "Kripya select kijiye ki aap kya banwana chahte hain, reply mein number bheinjein:\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website (Online Store)** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)");
                        } else if (targetMenuRoute === '2') {
                            userSessions[from].step = 'process_automation_menu';
                            return sendWhatsAppMessage(from, (userLang === 'EN')
                                ? "🤖 **AI Business Automation Hub**\nPlease reply with an option number (**1 to 5**):\n\n1️⃣ AI Content & SEO Maintainer ($77/Mo)\n2️⃣ B2B & Wholesale Lead Engine ($155/Mo)\n3️⃣ Service & Appointment Lead Engine ($155/Mo)\n4️⃣ E-Commerce Sales Automation Retainer ($155/Mo)\n5️⃣ Complete Digital Sales Engine ($311/Mo)\n\n📲 *Live Wholesale B2B Automation Demo:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo"
                                : "🤖 **AI Business Automation & Live Demo:**\nKripya niche diye gaye list mein se ek option number (**1 se 5**) ya naam reply kijiye:\n\n1️⃣ **AI Content & SEO Maintainer** (Base: ₹4,999/Mo)\n2️⃣ **B2B & Wholesale Lead Engine** (Base: ₹9,499/Mo)\n3️⃣ **Service & Appointment Lead Engine** (Base: ₹9,499/Mo)\n4️⃣ **E-Commerce Sales Automation Retainer** (Base: ₹9,499/Mo)\n5️⃣ **Complete Digital Sales Engine** (Base: ₹18,999/Mo)\n\n📲 *Live Wholesale B2B Automation Demo Link:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo");
                        } else if (targetMenuRoute === '3') {
                            userSessions[from].step = 'process_requirement_menu';
                            return sendWhatsAppMessage(from, (userLang === 'EN')
                                ? "🔥 *Exclusive Launch Offer Active!* (Flat 20% OFF Code Applied)\n\nPlease select your project requirement number to secure your discounted slot:\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Custom Enterprise App ($2,499)"
                                : "🔥 *Exclusive Launch Offer Active!* (Flat 20% OFF Coupon apply kar diya gaya hai)\n\nAap jis requirement par discount lock karna chahte hain, kripya uska number reply kijiye:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)");
                        } else if (targetMenuRoute === '4') {
                            userSessions[from].step = 'process_requirement_menu';
                            return sendWhatsAppMessage(from, (userLang === 'EN')
                                ? "💳 *Direct Booking & Token System ($49)*\n\nPlease select the project type you want to lock slot for via option number:\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Custom Enterprise App ($2,499)"
                                : "💳 *Direct Booking & Token System (₹999 Slot Lock)*\n\nAap jis project layout ke liye secure token register karna chahte hain, kripya uska option number bheinje:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)");
                        } else if (targetMenuRoute === '5') {
                            userSessions[from].step = 'awaiting_consultation_slot';
                            const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
                            
                            const optionA = (currentHourIST >= 17) ? "🅰️ *Kal Shaam 5:00 Baje*" : "🅰️ *Aaj Shaam 5:00 Baje*";
                            const optionB = (currentHourIST >= 17) ? "🅱️ *Parso Dopahar 12:00 Baje*" : "🅱️ *Kal Dopahar 12:00 Baje*";
                            const optionA_EN = (currentHourIST >= 17) ? "🅰️ *Tomorrow at 5:00 PM*" : "🅰️ *Today at 5:00 PM*";
                            const optionB_EN = (currentHourIST >= 17) ? "🅱️ *Day After Tomorrow at 12:00 PM*" : "🅱️ *Tomorrow at 12:00 PM*";

                            return sendWhatsAppMessage(from, (userLang === 'EN') 
                                ? `👤 *Direct Consultation with Shahid:*\n\n${optionA_EN}\n${optionB_EN}\n🅲️ *Custom Time (Type preferred time below)*\n\n👉 Reply with A, B, or C!` 
                                : `👤 *Direct Consultation with Shahid:*\n\n${optionA}\n${optionB}\n🅲️ *Custom Time (Apna secure timing niche type karein)*\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye!`);
                        }
                    }
                }
            }
        } catch (error) { console.error("Webhook processing logic error."); }
    }
});

// 🎯 REUSABLE LOGIC: FINALIZE CONSULTATION LEAD
async function finalizeConsultationLead(from, textInput, res) {
    const session = userSessions[from];
    const cleanName = session.clientName || "Valued Client";
    const clientEmail = session.clientEmail || "Not Provided";
    const dynamicSlot = session.requestedSlot || "Direct Scheduled Request";
    const userLang = session.lang;

    // Fixed: Tracking actual user currency region for Admin Notification mapping
    const isUSDTrack = (userLang === 'EN'); 
    const matchedBasePrice = getBasePriceByPlan(textInput, isUSDTrack);
    const finalCalculatedPrice = calculateTotalPayable(matchedBasePrice, isUSDTrack);
    
    const currency = isUSDTrack ? '$' : '₹';
    const taxLabel = isUSDTrack ? 'incl Gateway Fees' : 'incl GST';

    // Admin Notification Fix
    const comprehensiveAdminAlert = `🚨 *PRE-QUALIFIED B2B CONSULTATION LEAD!* 🚨\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n✉️ *Email:* ${clientEmail}\n📝 *Slot Details & Parameters:* Direct Consultation Slot: ${dynamicSlot}\n💬 *User Stated Objectives:* "${textInput}"\n💰 *Mapped Plan Base Price:* ${currency}${matchedBasePrice} (${currency}${finalCalculatedPrice} ${taxLabel})\n\n🤖 *Status:* Live details captured securely!`;
    await sendWhatsAppMessage("917529839762", comprehensiveAdminAlert);

    try {
        await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
            client_name: cleanName,
            whatsapp_number: from,
            email: clientEmail,
            requested_slot: dynamicSlot,
            discussion_notes: `*User Stated Objectives:* "${textInput}"\n\n${comprehensiveAdminAlert}`,
            project_scope: textInput, 
            calculated_price: finalCalculatedPrice 
        });
    } catch (apiErr) { console.error("Dashboard parameters execution failure handler."); }

    let confirmationText = (userLang === 'EN')
        ? `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Your specifications have been securely routed to Shahid. We will connect with you shortly! 🚀`
        : `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Aapka requirement details Shahid bhai tak pahunch gaya hai. Hamari team aapse jald hi raabta karegi! 🚀`;
    return sendWhatsAppMessage(from, confirmationText);
}

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
        // Improved Error Logging for dispatch failures
        console.error("WhatsApp API dispatch error:", e.response ? JSON.stringify(e.response.data) : e.message); 
    }
}

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`ChatBot engine live on port ${PORT}`));
