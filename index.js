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

// UPGRADED ROBUST PLAN PRICE MAPPER
function getBasePriceByPlan(planScope) {
    const text = String(planScope).toLowerCase().trim();
    
    if (text.includes("e-commerce") || text.includes("ecommerce") || text.includes("store") || text.includes("shop") || text.includes("retail")) {
        return "47500";
    }
    if (text.includes("starter business") || text.includes("business hub") || text.includes("corporate") || text.includes("brand growth")) {
        return "25500";
    }
    if (text.includes("basic small") || text.includes("small business") || text.includes("informational layout")) {
        return "12300";
    }
    if (text.includes("saas") || text.includes("app") || text.includes("software") || text.includes("enterprise") || text.includes("portal")) {
        return "145000";
    }
    if (text.includes("crm") || text.includes("workflow") || text.includes("sheet database")) {
        return "18000";
    }
    if (text.includes("whatsapp bot") || text.includes("lead sync") || text.includes("conversational bot")) {
        return "8713";
    }
    return "8713"; 
}

// =========================================================================
// 🟢 SERVER HEALTH CHECK ROUTE (FOR UPTIMEROBOT NO-SLEEP PING)
// =========================================================================
app.get('/', (req, res) => {
    res.status(200).send("Shahid Creatives Bot Server is Live and Active! 🚀");
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

                    // 🎯 STATE LAYER INTERCEPTOR 0: CAPTURE COURTESY REPLIES (THANKS/OK) AFTER REGISTRATION
                    if (currentStep === 'post_registration') {
                        const courtesyTriggers = ['thanks', 'thank you', 'ok', 'okay', 'ty', 'ji', 'shukriya', 'thx'];
                        
                        if (courtesyTriggers.includes(userText)) {
                            userSessions[from].step = 'main_menu'; // Reset back to baseline routing
                            
                            let courtesyReply = (userLang === 'EN')
                                ? "You're most welcome! 👍 Glad to help. Talk to you very soon!"
                                : "Aapka swagat hai! 👍 Milte hain aapse bohot jald sync call par. Have a great day ahead! ✨";
                            return sendWhatsAppMessage(from, courtesyReply);
                        }
                        // If they type anything else, seamlessly pass them down after resetting state
                        userSessions[from].step = 'main_menu';
                    }

                    // 🎯 STATE LAYER INTERCEPTOR 1: CAPTURE CUSTOM QUERY TEXT FIRST
                    if (currentStep === 'collect_custom_query') {
                        userSessions[from].temporaryQuery = rawText; // Storing query temporarily
                        userSessions[from].step = 'collect_consultation_details'; // Forwarding to lock profile vectors
                        
                        let replyText = (userLang === 'EN') 
                            ? "Got it! 📝 To lock your custom priority slot, please reply with your *Full Name* and *Email Address*."
                            : "Noted! 📝 Aapka priority slot block karne ke liye, kripya apna *Full Name* aur *Email ID* ek message mein bhejien.";
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 🎯 STATE LAYER INTERCEPTOR 2: CAPTURE IDENTITY VECTORS, SYNC CRM & ROUTE TO POST-REGISTRATION
                    if (currentStep === 'collect_consultation_details') {
                        const contactDetails = rawText;
                        userSessions[from].step = 'post_registration'; // Routing to courtesy monitoring buffer
                        
                        let cleanName = "Valued Client";
                        let cleanEmail = "Not Provided";
                        
                        try {
                            cleanName = contactDetails.split('\n')[0].split(',')[0].trim();
                            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
                            const emailMatch = contactDetails.match(globalEmailRegex);
                            if (emailMatch) cleanEmail = emailMatch[1].trim();
                        } catch (err) {
                            console.log("Error processing fallback data allocation structures.");
                        }

                        userSessions[from].clientName = cleanName;
                        userSessions[from].clientEmail = cleanEmail;
                        
                        const userSavedQuery = userSessions[from].temporaryQuery || "Custom Consultation Request";
                        const matchedBasePrice = "18000";

                        // Syncing lead metrics to your live cloud matrix
                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: cleanName, 
                                email: cleanEmail, 
                                whatsapp_number: from, 
                                project_scope: `Custom Slot: ${userSavedQuery}`, 
                                value: matchedBasePrice 
                            });
                        } catch (dbErr) { console.error("CRM sync fail on priority interceptor framework"); }

                        // Consolidated Rich Notification sent strictly to your personal mobile thread
                        const comprehensiveAdminAlert = `🚨 *PRE-QUALIFIED B2B CONSULTATION LEAD!* 🚨\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n✉️ *Email:* ${cleanEmail}\n📝 *Client Query:* "${userSavedQuery}"\n\n🤖 *Status:* Verified Inbound Ingested. Takeover thread now!`;
                        await sendWhatsAppMessage("917529839762", comprehensiveAdminAlert);

                        let confirmationText = "";
                        if (userLang === 'EN') {
                            confirmationText = `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Your specifications and identity vectors have been routed to Shahid. Our core alignment team will message you shortly! 🚀`;
                        } else {
                            confirmationText = `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Aapki requirement aur profile data Shahid bhai tak secure pahunch gaya hai. Hamari team custom time confirmation ke liye jald hi aapse raabta karegi! 🚀`;
                        }
                        return sendWhatsAppMessage(from, confirmationText);
                    }

                    // SECURITY STATE STEP: COMPLETED TRANSACTIONS PROTECTOR
                    const resetTriggers = ['hi', 'hello', 'menu', 'start', 'hey'];
                    const isAdOrMenuClick = resetTriggers.includes(userText) || userText.includes("get more info") || userText.includes("interested") || userText.includes("info") || userText.includes("bot");
                    
                    if (currentStep === 'completed' && !isAdOrMenuClick) {
                        let fallbackNotice = (userLang === 'EN')
                            ? "💡 Your booking profile is already active! Please reply with *'Menu'* to go back or click the checkout gateway link above to proceed."
                            : "💡 Aapka booking invoice link generate ho chuka hai! Main menu par wapas jaane ke liye *'Menu'* type kijiye ya upar diye gaye secure link par click karke checkout complete kijiye.";
                        return sendWhatsAppMessage(from, fallbackNotice);
                    }

                    // STATE RULE 1: CAPTURING REPLIES AFTER WEBSITE REDIRECT
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
                                replyText = `🎉 *Excellent Choice!* Your session data is validated. 🤝\n\nClick the official link below to pay your **Token Booking fee ($49)** via Razorpay. This will instantly reserve your delivery slot in *Shahid Creatives* automated production queue:\n\n🔗 *Pay Securely Here:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
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

                    // 🎯 STATE LAYER: PROCESSING CONSULTATION SLOT SELECTION (A, B, C)
                    if (currentStep === 'awaiting_consultation_slot') {
                        let confirmationText = "";
                        
                        if (userText === 'a' || userText.startsWith('a ') || userText.startsWith('a,')) {
                            let selectedSlot = "Aaj hi Shaam 5:00 Baje (Today 5 PM)";
                            userSessions[from].step = 'main_menu';
                            
                            const slotAdminAlert = `🚨 *LIVE CONSULTATION SLOT SELECTED!* 🚨\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${userSessions[from].clientName || 'Valued Client'}\n⏰ *Chosen Slot:* ${selectedSlot}\n\n🤖 *Status:* Takeover chat thread instantly to confirm details!`;
                            await sendWhatsAppMessage("917529839762", slotAdminAlert);

                            if (userLang === 'EN') {
                                confirmationText = `✅ *Slot Request Received!* \n\nI have locked *"${selectedSlot}"* as your preferred consultation timing. Shahid Alam will personally ping you here shortly! 🚀`;
                            } else {
                                confirmationText = `✅ *Slot Request Received!* \n\nMaine aapke liye *"${selectedSlot}"* ka timing lock kar diya hai. Shahid bhai aapse bohot jald is chat par connect karenge! 🚀`;
                            }
                            return sendWhatsAppMessage(from, confirmationText);
                        } 
                        
                        else if (userText === 'b' || userText.startsWith('b ') || userText.startsWith('b,')) {
                            let selectedSlot = "Kal Dopahar 12:00 Baje (Tomorrow 12 PM)";
                            userSessions[from].step = 'main_menu';
                            
                            const slotAdminAlert = `🚨 *LIVE CONSULTATION SLOT SELECTED!* 🚨\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${userSessions[from].clientName || 'Valued Client'}\n⏰ *Chosen Slot:* ${selectedSlot}\n\n🤖 *Status:* Takeover chat thread instantly!`;
                            await sendWhatsAppMessage("917529839762", slotAdminAlert);

                            if (userLang === 'EN') {
                                confirmationText = `✅ *Slot Request Received!* \n\nI have locked *"${selectedSlot}"* as your preferred consultation timing. Shahid Alam will personally ping you here shortly! 🚀`;
                            } else {
                                confirmationText = `✅ *Slot Request Received!* \n\nMaine aapke liye *"${selectedSlot}"* ka timing lock kar diya hai. Shahid bhai aapse bohot jald is chat par connect karenge! 🚀`;
                            }
                            return sendWhatsAppMessage(from, confirmationText);
                        }
                        
                        else if (userText === 'c' || userText.startsWith('c ') || userText.startsWith('c,')) {
                            userSessions[from].step = 'collect_custom_query';
                            
                            if (userLang === 'EN') {
                                confirmationText = `✍️ *Please share your requirement:* \n\nKindly type your business goal, project details, or query in the next message so Shahid can review it before scheduling your custom session!`;
                            } else {
                                confirmationText = `✍️ *Apni requirement share karein:* \n\nKripya agle message mein apna business goal, website/automation requirement ya jo bhi aapki query hai, short mein likh kar bhejien taaki Shahid bhai call se pehle use review kar sakein!`;
                            }
                            return sendWhatsAppMessage(from, confirmationText);
                        }
                    }

                    // STATE RULE 2: LEAD DETECTION PARSING ENGINE
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
                                value: parsedBasePrice 
                            });
                        } catch (apiError) { console.error("API Sync Failed"); }

                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail || 'Not Provided'}\n📝 *Plan Chosen:* ${projectScope}\n💰 *Base Valuation:* ${isGlobalWebsiteTemplate ? '$' : '₹'}${parsedBasePrice}\n\n🤖 *Status:* Synced with Cloud Ledger. Check Admin Panel!`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        let clientReply = "";
                        if (userLang === 'EN') {
                            clientReply = `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved on our production server.\n\n🔥 *Exclusive Reward Activated:* We have successfully mapped the launch coupon code **LAUNCH20** with your tracking node. This secures a **Flat 20% OFF** discount on your final project invoice bill!\n\n🚀 Would you like to confirm your design deployment slot with a **Token Booking ($49)** or schedule a strategy kickoff call right away?\n\nPlease reply with the number of your choice:\n\n1️⃣ **Book Token (Confirm Slot & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Schedule Strategy Call)**`;
                        } else {
                            clientReply = `Thank you *${clientName}*! 🙏 Aapka cost estimation data hamare production server par secure ho gaya hai.\n\n🔥 *Exclusive Offer Activated:* Maine aapke project profile ke sath launch coupon code **LAUNCH20** को टैg kar diya hai! Isse payment complete hone ke baad aapke main project price par **Flat 20% OFF (Discount)** apply ho jayega.\n\n🚀 Kya aap apna development slot instantly lock karke discount secure karna chahte hain, ya direct details discuss karna chahte hain?\n\nNiche diye gaye number se reply kijiye:\n\n1️⃣ **Token Book Karein (Slot Confirm & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Strategy Call)**`;
                        }
                        
                        userSessions[from].step = 'awaiting_website_action';
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    // INBOUND CHAT LEAD CAPTURE FLOW (B2B DIRECT CHAT)
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

                        const chatAdminNotification = `🌟 *NEW INBOUND CHAT LEAD!* 🌟\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n✉️ *Email:* ${cleanEmail || 'Not Provided'}\n📝 *Plan Scope:* ${userSessions[from].projectScope}\n💰 *Allocated Base:* ₹${matchedBasePrice}\n\n🤖 *Status:* Inbound state synced. Generate invoice keys!`;
                        await sendWhatsAppMessage("917529839762", chatAdminNotification);

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
                            replyText = `Thank you, aapki details receive ho gayi hain! 🤝\n\n🔥 *Launch Discount Applied:* Maine aapke profile ke sath **LAUNCH20** (Flat 20% OFF) active kar diya hai. Aap Razorpay से **₹999 Token Booking** complete karke slot lock kar sakte hain:\n\n🔗 *Direct Pay Gateway Link:* ${selfPayLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                        }
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 🔥 UNIFIED NAVIGATION MENU ENGINE
                    if (isAdOrMenuClick) {
                        userSessions[from].step = 'main_menu';
                        let replyText = "";
                        if (userLang === 'EN') {
                            replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nWe design premium agile web ecosystems and high-converting automation workflows.\n\nSelect a professional stack tier via number:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation & B2B Wholesale Demo**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid**";
                        } else {
                            replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nHum engineer karte hain high-performance websites aur AI automation frameworks global and local brands ke liye.\n\nKoshish ko aage badhane ke liye niche se ek option reply kijiye:\n\n1️⃣ *Web Development Tiers* (Saare Standard Custom Packages)\n2️⃣ *AI Business Automation & B2B Wholesale Demo* (Bots & CRM Flows)\n3️⃣ *🔥 Exclusive Launch Deal* (Flat 20% OFF Status)\n4️⃣ *💳 Direct Booking & Token System* (₹999 Secure Path)\n5️⃣ *👤 Talk to Shahid* (Direct Consultation)";
                        }
                        return sendWhatsAppMessage(from, replyText);
                    } else if (userText === '1') {
                        let replyText = "";
                        if (userLang === 'EN') {
                            replyText = "💻 *Shahid Creatives - Premium Web Tiers (All Available Packages):*\n\n• 💼 *Starter Premium Business Hub* ($299+) - Perfect for brand showcases. Includes 1-Yr Free Domain & Hosting.\n• 🛒 *Global E-commerce Engine* ($599) - Multi-currency Store + Stripe checkout automated integration.\n• 🚀 *Custom SaaS / Enterprise Portal* ($1,750+) - Tailored logic, secure multi-tenant databases & custom workflows.\n\n👉 Please reply with your preferred **Plan Name or Custom Specifications** to proceed!";
                        } else {
                            replyText = "💻 *Shahid Creatives - Web Development Tiers (Saare Plans Available):*\n\n• 📄 *Starter Plan* (Base Price: ₹8,713) - Portfolio, Single Page Landing, ya Online Visiting Card sites ke liye best.\n• 💼 *Basic Small Business* (Base Price: ₹12,300) - Informational layout (3-5 pages) local shops aur businesses ke liye.\n• 🌟 *Starter Business Hub* (Base Price: ₹25,500) - Complete corporate systems, brand growth layouts & lead capture systems.\n• 🛒 *E-commerce Hub* (Base Price: ₹47,500) - Full-fledged Online Store with Product Listing, Cart, Coupons & Billing gateways.\n• 🚀 *Custom SaaS App* (Base Price: ₹1,45,000+) - Scalable web applications, admin dashboards, and custom business tools.\n\n💡 Note: All prices are subject to +18% GST and 2.5% transaction charges.\n\n👉 Aap kaun sa package choose karna chahte hain? Niche uska naam ya specifications reply mein share kijiye!";
                        }
                        userSessions[from].step = 'collect_details';
                        return sendWhatsAppMessage(from, replyText);
                    } else if (userText === '2') {
                        let replyText = "";
                        if (userLang === 'EN') {
                            replyText = "🤖 *AI Business Automation Hub (All Available Configurations):*\n\n• 🤖 *Enterprise Custom AI Hub* ($299 onwards) - Multi-currency receipt automation, dynamic parameters link injection, Stripe gateway sync, and enterprise native infrastructure.\n\n💡 *B2B Wholesale Live Automation Demo:* Experience how our automation systems seamlessly manage stocks, orders, and data workflows live!\n🔗 *Experience Live Demo:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo\n\n👉 Reply with your business workflow or automation goal to initiate development! Or type *BOOK* to reserve this stack.";
                        } else {
                            replyText = "🤖 *AI Business Automation & Live Demo (Saare Plans Available):*\n\n• 🤖 *WhatsApp Bot & Lead Sync* (Base Price: ₹8,713) - Basic conversational bot, text parsing engine, dashboard real-time CRM synchronization.\n• 🏢 *Custom CRM Workflow Hub* (Base Price: ₹18,000) - Complete internal sheet database connectivity, automated tasks, priority alert paths.\n• 🚀 *Enterprise AI Automation Suite* (Tailored Pricing) - Multi-channel bots, complex webhooks handler, automated workflows.\n\n📲 *B2B Wholesale Live Automation Demo:*\nYeh AI system aapke wholesale business ko 24/7 super-fast bana dega. Click karke live process dekhiye:\n🔗 *Live Web Demo Path:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo\n\n👉 Apne automation requirements niche reply mein batayein ya slot lock karne ke liye *BOOK* type karein!";
                        }
                        userSessions[from].step = 'collect_details';
                        return sendWhatsAppMessage(from, replyText);
                    } else if (userText === '3') {
                        let replyText = (userLang === 'EN')
                            ? "🔥 *Exclusive Global Launch Offer!* 🔥\n\nWe have successfully mapped the launch coupon code **LAUNCH20** with your tracking node. This secures a **Flat 20% OFF** discount on your final project invoice bill!\n\n👉 Reply with your **Name and Project Goal** right now to tag your discount code!"
                            : "🔥 *Exclusive Launch Offer!* 🔥\n\nMubarak ho! Aap premium setup models par **Flat 20% Discount** ke liye eligible hain. Maine aapke session ke sath coupon code **LAUNCH20** active kar diya hai.\n\n👉 Is discount code ko secure karne ke liye niche apna **Name aur Project Type** likh kar bhejien.";
                        userSessions[from].step = 'collect_details';
                        return sendWhatsAppMessage(from, replyText);
                    } else if (userText === '4') {
                        let replyText = (userLang === 'EN')
                            ? "💳 *Direct Booking & Token System ($49):*\n\nTo construct your dynamic link invoice panel, please provide your **Full Name, Contact Number, and Project/Plan Name**."
                            : "💳 *Direct Booking & Token System (₹999 Slot Lock):*\n\nYour custom live checkout portal status configure karne ke liye, kripya apna **Name, Phone Number, aur Project Name/Plan** reply mein bhejien.";
                        userSessions[from].step = 'collect_details';
                        return sendWhatsAppMessage(from, replyText);
                    } else if (userText === '5') {
                        let replyText = "";
                        userSessions[from].step = 'awaiting_consultation_slot';
                        
                        if (userLang === 'EN') {
                            replyText = `👤 *Direct Consultation with Shahid:*\n\nShahid Alam will connect with you directly on this thread. To lock your free 15-minute priority growth strategy sync, select a slot option:\n\n🅰️ **Today at 5:00 PM**\n🅱️ **Tomorrow at 12:00 PM**\n🅲 **Custom Time (Type preferred time below)**\n\n👉 Kindly reply with *A, B, or C* to secure your slot!`;
                        } else {
                            replyText = `👤 *Direct Consultation with Shahid:*\n\nShahid Alam aapke sath is thread par directly connect karenge. Apna free 15-minute priority growth consultation slot instantly book karne ke liye ek option choose karein:\n\n🅰️ **Aaj hi Shaam 5:00 Baje**\n🅱️ **Kal Dopahar 12:00 Baje**\n🅲 **Custom Time (Apna secure timing niche type karein)**\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye!`;
                        }
                        return sendWhatsAppMessage(from, replyText);
                    } else {
                        let replyText = (userLang === 'EN')
                            ? "I didn't quite catch that. 🤔 Please reply with *'Hi'* or *'Hello'* to open the main menu!"
                            : "Main samajh nahi paya. 🤔 Dobara structured menus dekhne ke liye ek baar *'Hi'* ya *'Hello'* bhejien!";
                        return sendWhatsAppMessage(from, replyText);
                    }
                }
            }
        } catch (error) { console.error("Webhook processing exception:", error.message); }
    }
});

// OUTBOUND DUE REMINDERS API ROUTE
app.post('/api/send-payment-reminder', async (req, res) => {
    const { 
        whatsapp_number, client_name, project_name, dues_amount, reference_id,
        portal_link, payment_link, payment_url, link, url 
    } = req.body;

    if (!whatsapp_number || !dues_amount) {
        return res.status(400).json({ success: false, error: "Missing required tracking parameters" });
    }

    const targetLink = portal_link || payment_link || payment_url || link || url || "https://shahidcreatives.com/#portal";

    let formattedNumber = whatsapp_number.replace(/[^0-9]/g, '');
    if (!formattedNumber.startsWith('91') && formattedNumber.length === 10) {
        formattedNumber = '91' + formattedNumber;
    }

    const reminderMessage = `⚠️ *PAYMENT REMINDER | SHAHID CREATIVES* ⚠️\n\n` +
                            `Hello *${client_name || 'Valued Client'}*! 🙏\n\n` +
                            `Yeh aapke project *${project_name || 'Custom Web Infrastructure'}* ke pending outstanding dues ka ek professional account reminder hai.\n\n` +
                            `💰 *Outstanding Balance:* ₹${dues_amount}\n` +
                            `📌 *Project Tracking ID:* ${reference_id || 'SC-MAIN'}\n\n` +
                            `Kripya niche diye gaye official portal path secure link par click karke apna pending milestone amount clear kijiye:\n\n` +
                            `🔗 *Secure Payment Link:* ${targetLink}\n\n` +
                            `Thank you for your continuous partnership! 🚀`;

    try {
        await sendWhatsAppMessage(formattedNumber, reminderMessage);
        return res.status(200).json({ success: true, message: "Reminder dispatched seamlessly with hyperlink!" });
    } catch (error) {
        console.error("Error sending admin dashboard reminder:", error.message);
        return res.status(500).json({ success: false, error: "Meta API integration rejection" });
    }
});

// =========================================================================
// 🔐 🌟 AUTOMATED CREDENTIALS TRIGGER PIPELINE
// =========================================================================
app.post('/api/send-client-credentials', async (req, res) => {
    const { 
        whatsapp_number, phone, client_name, project_scope, project_name, 
        portal_id, client_id, password, plain_password, login_link, portal_link,
        custom_phone_id, custom_token
    } = req.body;

    const activePassword = password || plain_password;
    const activePortalId = portal_id || client_id;
    const activeProject = project_scope || project_name || "Custom Web Development";
    const targetLoginLink = login_link || portal_link || "https://shahidcreatives.com/#portal";
    
    let rawNumber = whatsapp_number || phone;
    
    if (!rawNumber && client_name) {
        if (client_name.includes("Abdul Ajij")) {
            rawNumber = "919914072700"; 
        } else if (client_name.includes("Alam")) {
            rawNumber = "917529839762";
        }
    }

    if (!rawNumber || !activePortalId || !activePassword) {
        return res.status(400).json({ success: false, error: "Missing required authentication fields" });
    }

    let formattedNumber = String(rawNumber).replace(/[^0-9]/g, '');
    if (formattedNumber.length === 10) {
        formattedNumber = '91' + formattedNumber;
    }

    const welcomeCredentialMessage = `🎉 *WELCOME TO SHAHID CREATIVES CLOUD HUB* 🎉\n\n` +
                                     `Hello *${client_name || 'Valued Client'}*! 🙏\n\n` +
                                     `Aapke project *${activeProject}* ka work management layout deploy ho chuka hai! Secure credentials se Dashboard open karke live updates track karein.\n\n` +
                                     `🔐 *YOUR PORTAL CREDENTIALS:* \n` +
                                     `📌 *Client Portal ID:* \` ${activePortalId} \` \n` +
                                     `🔑 *Secure Password:* \` ${activePassword} \` \n\n` +
                                     `🚀 *Direct Access Dashboard Path:* \n` +
                                     `🔗 ${targetLoginLink}\n\n` +
                                     `Welcome aboard! 🤝✨`;

    try {
        await sendWhatsAppMessage(formattedNumber, welcomeCredentialMessage, custom_phone_id, custom_token);
        return res.status(200).json({ success: true, message: "Credentials successfully dispatched over WhatsApp!" });
    } catch (error) {
        console.error("❌ META API CREDENTIALS REJECTION:", error.message);
        return res.status(500).json({ success: false, error: "Meta API integration rejection" });
    }
});

// =========================================================================
// 🚀 DYNAMIC MULTI-CLIENT ASSIGNABLE INTERFACE HELPER
// =========================================================================
async function sendWhatsAppMessage(to, text, customPhoneId = null, customToken = null) {
    const DEFAULT_TOKEN = process.env.WHATSAPP_TOKEN;
    const DEFAULT_PHONE_NUMBER_ID = "1202984902891472";

    const activeToken = customToken || DEFAULT_TOKEN;
    const activePhoneId = customPhoneId || DEFAULT_PHONE_NUMBER_ID;

    await axios({
        method: "POST", 
        url: `https://graph.facebook.com/v18.0/${activePhoneId}/messages`,
        data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } },
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${activeToken}` }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ChatBot engine live on port ${PORT}`));
