const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const userSessions = {};

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
                            clientEmail: "", // Added to session object
                            projectScope: "Custom Project Development"
                        };
                    }
                    
                    const userLang = userSessions[from].lang;

                    // =========================================================
                    // 1. WEBSITE LEAD AUTO-DETECTION & CRM SYNC (BULLETPROOF PARSER)
                    // =========================================================
                    if (rawText.includes("Hi Shahid Creatives!") || rawText.includes("lock in my custom website estimate")) {
                        
                        let clientName = "Valued Client";
                        let clientEmail = "";
                        let projectScope = "Website Custom Estimate";
                        let estimatedValue = "8713"; 

                        try {
                            // 🌟 ADVANCED REGEX PARSER: Emojis, Spaces, and Special Characters safe lines
                            const nameMatch = rawText.match(/(?:Client Name|👤[^:]*):\s*([^\n\r]+)/i);
                            const emailMatch = rawText.match(/(?:Email Address|✉️[^:]*):\s*([^\n\r\s]+)/i);
                            const scopeMatch = rawText.match(/(?:Category Model|Model|Specifications[^:]*):\s*([^\n\r]+)/i);
                            const priceMatch = rawText.match(/(?:Estimated Price|Total Due[^:]*):\s*([^\n\r]+)/i);

                            if (nameMatch) {
                                clientName = nameMatch[1].split(',')[0].trim();
                            }
                            if (emailMatch) {
                                // Clean up mailto links or anchor markup if injected by browser engine wrappers
                                clientEmail = emailMatch[1].replace(/[<>]/g, '').trim();
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
                        } catch (parseError) {
                            console.error("Advanced template parsing engine failed:", parseError.message);
                        }

                        // Save clean context mapping properties inside memory storage session
                        userSessions[from].clientName = clientName;
                        userSessions[from].clientEmail = clientEmail;
                        userSessions[from].projectScope = projectScope;

                        // Sync to Custom Dashboard Backend CRM
                        try {
                            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                                client_name: clientName,
                                email: clientEmail, // Added email metadata layer to backend pipeline
                                whatsapp_number: from,
                                project_scope: "Website: " + projectScope,
                                value: estimatedValue
                            });
                        } catch (apiError) {
                            console.error("Dashboard DB Sync Failed:", apiError.message);
                        }

                        // Notification alert route dispatched to Shahid Bhai's profile channel
                        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* +${from}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail || 'Not Provided'}\n📝 *Plan:* ${projectScope}\n💰 *Value:* ${estimatedValue}\n\n🤖 *Status:* System synced. Check Admin Panel!`;
                        await sendWhatsAppMessage("917529839762", adminNotification);

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

                    if (currentStep === 'awaiting_website_action') {
                        if (userText === '1') {
                            userSessions[from].step = 'main_menu'; 

                            const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`; 
                            const encodedName = encodeURIComponent(userSessions[from].clientName);
                            const encodedEmail = encodeURIComponent(userSessions[from].clientEmail || "");
                            const encodedPlan = encodeURIComponent(userSessions[from].projectScope);
                            
                            if (userLang === 'EN') {
                                const tokenAmountUSD = "49";
                                // 🌟 UPGRADED LINK: Passing email parameter explicitly into web interface hash template routing
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}`;
                                replyText = `💳 *Excellent Choice!* Click the official checkout gateway link below to pay the **Token Booking fee ($49)** via Razorpay:\n\n🔗 *Pay Securely Here:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                            } else {
                                const tokenAmountINR = "999";
                                // 🌟 UPGRADED LINK: Passing email parameter explicitly into web interface hash template routing
                                const dynamicPaymentLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}`;
                                replyText = `Thank you, aapki details receive ho gayi hain! 🤝\n\nMaine aapke chat data ke aadhar par aapka **Direct Token Payment Link** generate kar diya hai. Aap direct Razorpay se **₹999 Token Booking** complete kar sakte hain. Isse *Shahid Creatives* mein aapka slot automatic book ho jayega:\n\n🔗 *Direct Pay Gateway Link:* ${dynamicPaymentLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                            }
                            return sendWhatsAppMessage(from, replyText);
                        } 
                        else if (userText === '2') {
                            userSessions[from].step = 'main_menu';
                            replyText = (userLang === 'EN')
                                ? "👤 Perfect! Shahid will connect with you shortly for a strategy sync call."
                                : "👤 Perfect! Shahid bhai bohot jald aapke sath strategy call par connect karenge. Get ready to launch! 🚀";
                            return sendWhatsAppMessage(from, replyText);
                        }
                    }

                    // 2. INBOUND CHAT LEAD CAPTURE FLOW
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
                        
                        // Fallback parsing inline inputs for direct chatbot flows
                        if(contactDetails.includes("@")) {
                            const emailArr = contactDetails.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi);
                            if(emailArr) cleanEmail = emailArr[0].trim();
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
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountUSD}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}`;
                            replyText = `Thank you, your profile has been secured! 🤝\n\n🔗 *Pay Securely Here:* ${selfPayLink}\n\n*Reference ID:* ${uniqueProjectId}`;
                        } else {
                            const tokenAmountINR = "999";
                            const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmountINR}&name=${encodedName}&email=${encodedEmail}&phone=${from}&plan=${encodedPlan}`;
                            replyText = `Thank you, aapki details receive ho gayi hain! 🤝\n\n🔗 *Direct Pay Gateway Link:* ${selfPayLink}\n\n*Project Reference ID:* ${uniqueProjectId}`;
                        }
                        return sendWhatsAppMessage(from, replyText);
                    }

                    // 3. MAIN MENU NAVIGATION
                    if (userText === 'hi' || userText === 'hello' || userText === 'menu' || userText === 'start') {
                        userSessions[from].step = 'main_menu';
                        if (userLang === 'EN') {
                            replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\n1️⃣ **Web Development Tiers**\n2️⃣ **AI Business Automation**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid**";
                        } else {
                            replyText = "Hello! Welcome to *Shahid Creatives*. 🚀\n1️⃣ *Web Development Tiers*\n2️⃣ *AI Business Automation*\n3️⃣ *🔥 Exclusive Launch Deal*\n4️⃣ *💳 Direct Booking & Token System*\n5️⃣ *👤 Talk to Shahid*";
                        }
                    } 
                    else if (userText === '1') {
                        replyText = (userLang === 'EN') ? "💻 Premium Web Tiers. Please reply with requirements." : "💻 Web Tiers. Please reply with requirements.";
                        userSessions[from].step = 'collect_details';
                    } 
                    else if (userText === '2') {
                        replyText = "🤖 AI Automation Hub. Share your workflow details.";
                        userSessions[from].step = 'collect_details';
                    }
                    else if (userText === '3') {
                        replyText = "🔥 Flat 20% Discount. Share your name to lock.";
                        userSessions[from].step = 'collect_details';
                    }
                    else if (userText === '4') {
                        replyText = "💳 Share Name, Phone, and Plan to generate dynamic link.";
                        userSessions[from].step = 'collect_details';
                    }
                    else if (userText === '5') {
                        replyText = "👤 Shahid will connect shortly. Share your preferred timing.";
                        userSessions[from].step = 'collect_details';
                    }
                    else {
                        replyText = "Please reply with 'Hi' or 'Hello' to restart.";
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
        data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } },
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${WHATSAPP_TOKEN}` }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); });
