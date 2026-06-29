const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// 🟢 LIGHTWEIGHT IN-MEMORY STORAGE (Render configuration ready, zero database dependency!)
const userSessions = {};

// 📈 DYNAMIC PRICING LEDGER MAPPING
function calculateTotalPayable(basePrice) {
    const cleanBase = parseFloat(basePrice.toString().replace(/[^0-9.]/g, ''));
    if (isNaN(cleanBase)) return 0;
    const withGST = cleanBase * 1.18; 
    const totalPayable = withGST * 1.025; 
    return Math.round(totalPayable);
}

// 🎯 ROBUST PLAN PRICE MAPPER
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

// 🤖 SERVER HEALTH CHECK (For 24/7 UptimeRobot Connection)
app.get('/', (req, res) => {
    res.status(200).send("Shahid Creatives Bot Server is Live on Render! Complete and Active! 🚀");
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
                    
                    // ⚡ Reset mechanism for fallback restart
                    const resetTriggers = ['hi', 'hello', 'menu', 'start', 'hey'];
                    if (resetTriggers.includes(userText)) {
                        userSessions[from] = null;
                    }

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

                    // 🎯 STATE 0: COURTESY REPLIES RESET BUFFER
                    if (currentStep === 'post_registration') {
                        const courtesyTriggers = ['thanks', 'thank you', 'ok', 'okay', 'ji', 'shukriya', 'thx'];
                        if (courtesyTriggers.includes(userText)) {
                            userSessions[from] = null;
                            let courtesyReply = (userLang === 'EN')
                                ? "You're most welcome! 👍 Glad to help. Type 'Menu' anytime to restart."
                                : "Aapka swagat hai! 👍 Milte hain aapse bohot jald sync call par. Dobara shuru karne ke liye 'Menu' bheinje.";
                            return sendWhatsAppMessage(from, courtesyReply);
                        }
                        userSessions[from] = null;
                    }

                    // 🎯 STATE 1: COLLECT IDENTITY (OPTION 5 -> C PIPELINE)
                    if (currentStep === 'collect_consultation_identity') {
                        userSessions[from].step = 'collect_custom_query_and_time'; 
                        let cleanName = rawText.split('\n')[0].split(',')[0].trim();
                        userSessions[from].clientName = cleanName;

                        return sendWhatsAppMessage(from, (userLang === 'EN')
                            ? `Thank you *${cleanName}*! 🙏\n\nNow, please share your **Project Requirement** along with your **Preferred Custom Time** for the strategy call.`
                            : `Thank you *${cleanName}*! 🙏\n\nAb kripya agle message mein apni **Website/Automation Requirement** aur sath hi apna **Preferred Custom Time** (jab aap call par baat karna chahte hain) ek sath likh kar bhejien.`);
                    }

                    // 🎯 STATE 2: DISPATCH CUSTOM QUERY & TIME TO ADMIN SHAHID
                    if (currentStep === 'collect_custom_query_and_time') {
                        userSessions[from].step = 'post_registration';
                        const cleanName = userSessions[from].clientName;

                        const comprehensiveAdminAlert = `🚨 *PRE-QUALIFIED B2B CONSULTATION LEAD!* 🚨\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n📝 *Custom Time & Query:* "${rawText}"\n\n🤖 *Status:* Live details captured securely!`;
                        await sendWhatsAppMessage("917529839762", comprehensiveAdminAlert);

                        let confirmationText = (userLang === 'EN')
                            ? `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Your custom timing and specifications have been securely routed to Shahid. We will connect with you shortly! 🚀`
                            : `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Aapka custom timing aur requirement details Shahid bhai tak pahunch gaya hai. Hamari team aapse jald hi raabta karegi! 🚀`;
                        return sendWhatsAppMessage(from, confirmationText);
                    }

                    // 🎯 STATE 3: INBOUND SEQUENCE - DETAILS ACQUISITION
                    if (currentStep === 'collect_details') {
                        userSessions[from].projectScope = rawText;
                        userSessions[from].step = 'ask_name_email';
                        let replyText = (userLang === 'EN') 
                            ? "Awesome! 📝 Kindly reply with your **Full Name** and **Email Address**." 
                            : "Awesome! 📝 Kripya apna **Full Name** aur **Email ID** bhej lijiye.";
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

                        const matchedBasePrice = getBasePriceByPlan(userSessions[from].projectScope);
                        const finalPayable = calculateTotalPayable(matchedBasePrice);
                        
                        const chatAdminNotification = `🌟 *NEW INBOUND CHAT LEAD!* 🌟\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${cleanName}\n📝 *Plan Scope:* ${userSessions[from].projectScope}\n💰 *Calculated Price (incl GST):* ₹${finalPayable}`;
                        await sendWhatsAppMessage("917529839762", chatAdminNotification);

                        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
                        const encodedName = encodeURIComponent(cleanName);
                        const encodedEmail = encodeURIComponent(cleanEmail);
                        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);

                        let replyText = "";
                        if (userLang === 'EN') {
                            const tokenAmountUSD = "49";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Thank you, your profile is secure! 🤝\n\n🔥 *Launch Discount Applied:* Your code **LAUNCH20** (Flat 20% OFF) is successfully linked.\n\n🔗 *Pay Securely Here:* ${selfPayLink}`;
                        } else {
                            const tokenAmountINR = "999";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                            replyText = `Thank you, aapki details receive ho gayi hain! 🤝\n\n🔥 *Launch Discount Applied:* Coupon code **LAUNCH20** (Flat 20% OFF) active ho gaya hai. Aap Razorpay se **₹999 Token Booking** complete karke slot lock kar sakte hain:\n\n🔗 *Direct Pay Gateway Link:* ${selfPayLink}`;
                        }
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 🎯 STATE 5: META ADS LEAD CAPTURE LINKS REDIRECTING (OPTIONS 1 OR 2)
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
                                replyText = `🎉 *Excellent Choice!* Your data is validated. 🤝\n\nClick below to clear your **Token Booking ($49)**:\n\n🔗 *Pay Securely Here:* ${dynamicPaymentLink}`;
                            } else {
                                const tokenAmountINR = "999";
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}&coupon=LAUNCH20`;
                                replyText = `Thank you, details received! 🤝\n\n🔗 *Direct Pay Gateway Link:* ${dynamicPaymentLink}`;
                            }
                            return sendWhatsAppMessage(from, replyText);
                        } else if (userText === '2') {
                            userSessions[from].step = 'post_registration';
                            let replyText = (userLang === 'EN') ? "👤 Perfect! Shahid will connect with you shortly for a strategy sync call." : "👤 Perfect! Shahid bhai bohot jald aapke sath strategy call par connect karenge. Get ready to launch! 🚀";
                            return sendWhatsAppMessage(from, replyText);
                        }
                    }

                    // 🎯 STATE 6: CONSULTATION FIXED SLOTS ROUTING (A, B, C)
                    if (currentStep === 'awaiting_consultation_slot') {
                        if (userText === 'a' || userText.startsWith('a ') || userText.startsWith('a,')) {
                            userSessions[from].step = 'post_registration';
                            await sendWhatsAppMessage("917529839762", `🚨 *SLOT SELECTED!* 🚨\n📱 +${from}\n⏰ Chosen Slot: Aaj hi Shaam 5:00 Baje`);
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✅ *Slot Request Received!* Today 5 PM is locked." : "✅ *Slot Request Received!* Aaj Shaam 5 baje ka timing lock ho gaya hai.");
                        } else if (userText === 'b' || userText.startsWith('b ') || userText.startsWith('b,')) {
                            userSessions[from].step = 'post_registration';
                            await sendWhatsAppMessage("917529839762", `🚨 *SLOT SELECTED!* 🚨\n📱 +${from}\n⏰ Chosen Slot: Kal Dopahar 12:00 Baje`);
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✅ *Slot Request Received!* Tomorrow 12 PM is locked." : "✅ *Slot Request Received!* Kal dopahar 12 baje ka timing lock ho gaya hai.");
                        } else if (userText === 'c' || userText.startsWith('c ') || userText.startsWith('c,')) {
                            userSessions[from].step = 'collect_consultation_identity';
                            return sendWhatsAppMessage(from, (userLang === 'EN') ? "✍️ *Please complete your profile:* Kindly reply with your *Full Name and Email Address*." : "✍️ *Apna profile register karein:* Kripya apna *Full Name* aur *Email ID* reply mein bhejien.");
                        }
                    }

                    // 🎯 STATE 7: META ADS INTAKE AD-SET INTERCEPTOR
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate")) {
                        if (userSessions[from].lastSubmitedTime && (Date.now() - userSessions[from].lastSubmitedTime < 60000)) { return; }
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
                        } catch (parseError) { console.error("Parser failure exception."); }

                        userSessions[from].clientName = clientName;
                        userSessions[from].clientEmail = clientEmail;
                        userSessions[from].projectScope = projectScope;
                        userSessions[from].step = 'awaiting_website_action';

                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client Contact:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail || 'Not Provided'}\n📝 *Plan Chosen:* ${projectScope}\n💰 *Base Valuation:* ${isGlobalWebsiteTemplate ? '$' : '₹'}${parsedBasePrice}`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

                        let clientReply = (userLang === 'EN')
                            ? `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved.\n\n🔥 *Exclusive Reward Activated:* Launch code **LAUNCH20** secures a **Flat 20% OFF** discount!\n\nPlease reply with your choice number:\n\n1️⃣ **Book Token (Confirm Slot & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Schedule Strategy Call)**`
                            : `Thank you *${clientName}*! 🙏 Aapka data server par secure ho gaya hai.\n\n🔥 *Exclusive Offer Activated:* Coupon code **LAUNCH20** (Flat 20% OFF) active ho gaya hai!\n\nNiche diye gaye number se reply kijiye:\n\n1️⃣ **Token Book Karein (Slot Confirm & Claim 20% OFF)**\n2️⃣ **Discuss Requirements (Strategy Call)**`;
                        
                        return sendWhatsAppMessage(from, clientReply);
                    }

                    // 🎯 STATE 8: UNIFIED DYNAMIC CORE MENU ENGINE
                    userSessions[from].step = 'main_menu';
                    let replyText = "";
                    if (userLang === 'EN') {
                        replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\nWe design premium agile web ecosystems and high-converting automation workflows.\n\nSelect a professional stack tier via number:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation & B2B Wholesale Demo**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid**";
                    } else {
                        replyText = "Hello! Welcome to *Shahid Creatives* (Ludhiana, Punjab). 🚀\nHum engineer karte hain high-performance websites aur AI automation frameworks global and local brands ke liye.\n\nKoshish ko aage badhane ke liye niche se ek option reply kijiye:\n\n1️⃣ *Web Development Tiers* (Saare Standard Custom Packages)\n2️⃣ *AI Business Automation & B2B Wholesale Demo* (Bots & CRM Flows)\n3️⃣ *🔥 Exclusive Launch Deal* (Flat 20% OFF Status)\n4️⃣ *💳 Direct Booking & Token System* (₹999 Secure Path)\n5️⃣ *👤 Talk to Shahid* (Direct Consultation)";
                    }

                    if (userText === '1') {
                        userSessions[from].step = 'collect_details';
                        replyText = (userLang === 'EN')
                            ? "💻 *Shahid Creatives - Premium Web Tiers:*\n• 💼 *Starter Business Hub* ($299+)\n• 🛒 *Global E-commerce Engine* ($599)\n• 🚀 *Custom SaaS Enterprise Portal* ($1,750+)\n\n👉 Please reply with your preferred **Plan Name or Custom Specifications**!"
                            : "💻 *Shahid Creatives - Web Development Tiers:*\n• 📄 *Starter Plan* (Base Price: ₹8,713)\n• 💼 *Basic Small Business* (Base Price: ₹12,300)\n• 🌟 *Starter Business Hub* (Base Price: ₹25,500)\n• 🛒 *E-commerce Hub* (Base Price: ₹47,500)\n• 🚀 *Custom SaaS App* (Base Price: ₹1,45,000+)\n\n👉 Aap kaun sa package choose karna chahte hain? Niche specifications reply mein share kijiye!";
                    } else if (userText === '2') {
                        userSessions[from].step = 'collect_details';
                        replyText = (userLang === 'EN')
                            ? "🤖 *AI Business Automation Hub:*\n• 🤖 *Enterprise Custom AI Hub* ($299+)\n📲 *B2B Wholesale Live Automation Demo:*\n🔗 https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo\n\n👉 Reply with your business workflow or automation goal to initiate development!"
                            : "🤖 *AI Business Automation & Live Demo:*\n• 🤖 *WhatsApp Bot & Lead Sync* (Base Price: ₹8,713)\n• 🏢 *Custom CRM Workflow Hub* (Base Price: ₹18,000)\n• 🚀 *Enterprise AI Suite* (Tailored Pricing)\n📲 *B2B Wholesale Live Automation Demo:*\n🔗 https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo\n\n👉 Apne automation requirements niche reply mein batayein!";
                    } else if (userText === '3') {
                        userSessions[from].step = 'collect_details';
                        replyText = (userLang === 'EN')
                            ? "🔥 *Exclusive Global Launch Offer!* 🔥\nCoupon code **LAUNCH20** linked! Secures a **Flat 20% OFF** discount on final project invoice bill.\n\n👉 Reply with your **Name and Project Goal** right now to tag your discount code!"
                            : "🔥 *Exclusive Launch Offer!* 🔥\nMubarak ho! Coupon code **LAUNCH20** active kar diya hai. Secure a **Flat 20% Discount** on your project profile!\n\n👉 Is discount code ko lock karne ke liye niche apna **Name aur Project Type** likh kar bhejien.";
                    } else if (userText === '4') {
                        userSessions[from].step = 'collect_details';
                        replyText = (userLang === 'EN')
                            ? "💳 *Direct Booking & Token System ($49):*\nTo construct your gateway, please provide your **Full Name, Contact Number, and Project/Plan Name**."
                            : "💳 *Direct Booking & Token System (₹999 Slot Lock):*\nYour custom live checkout status configure karne ke liye, kripya apna **Name, Phone Number, aur Project Name/Plan** reply mein bhejien.";
                    } else if (userText === '5') {
                        userSessions[from].step = 'awaiting_consultation_slot';
                        replyText = (userLang === 'EN')
                            ? `👤 *Direct Consultation with Shahid:*\nTo lock your free 15-minute growth strategy sync, select a slot:\n\n🅰️ **Today at 5:00 PM**\nⓑ **Tomorrow at 12:00 PM**\nⒸ **Custom Time (Type preferred time below)**\n\n👉 Kindly reply with *A, B, or C* to secure your slot!`
                            : `👤 *Direct Consultation with Shahid:*\nShahid Alam aapke sath directly connect karenge. Priority growth consultation slot book karne ke liye ek option choose karein:\n\n🅰️ **Aaj hi Shaam 5:00 Baje**\nⓑ **Kal Dopahar 12:00 Baje**\nⒸ **Custom Time (Apna secure timing niche type karein)**\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye!`;
                    }
                    
                    return sendWhatsAppMessage(from, replyText);
                }
            }
        } catch (error) { console.error("Webhook processing logic error."); }
    }
});

async function sendWhatsAppMessage(to, text) {
    // 🔒 LIVE LONG-LIVED ACCESS TOKEN KEY HARDCODED FOR DIRECT HANDSHAKE
    const FIXED_ACCESS_TOKEN = "EAAOT5XBXyVwBR7v5XwYnbITF4zF3xWzQXikBjAH1w2qu0sQTbVkyqpNvmRAqhkmU7BqCEcthw5CHelfzr3fmDF2C3la6lw28iYLPI3EmZAZC6vDQoHQyiZAKz7QmfuiZBh0TKhusnrH6CeJZBJLdwU30MOzyr7Vkn26w5dE4md74Bu4OwoLzqfmCCtFDZA9AZDZD"; 
    const DEFAULT_PHONE_NUMBER_ID = "1138974165971937"; 
    try {
        await axios({
            method: "POST", 
            url: `https://graph.facebook.com/v18.0/${DEFAULT_PHONE_NUMBER_ID}/messages`,
            data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } },
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${FIXED_ACCESS_TOKEN}` }
        });
    } catch (e) { console.error("WhatsApp API dispatch error."); }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ChatBot engine live on port ${PORT}`));
