const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api'); // 🟢 TELEGRAM LIBRARY ADDED

const app = express();
app.use(bodyParser.json());

// ==========================================
// 🚀 GLOBAL SCHEDULING & REMINDER ENGINE (NEW)
// ==========================================
const bookedSlots = { salon: {}, clinic: {} }; 
const activeAppointments = []; // Stores appointments for auto-reminders

// Helper: Filter times based on IST, Past time hiding, & 4-client limit
function getAvailableTimes(botType, selectedDateStr) {
    const isToday = selectedDateStr === 'Today';
    const nowIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    const currentHour = nowIST.getHours();
    const currentMin = nowIST.getMinutes();

    const rawTimes = botType === 'salon'
        ? ["9:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"]
        : ["8:00 AM", "10:00 AM", "12:00 PM", "2:00 PM", "4:00 PM", "6:00 PM", "8:00 PM", "9:30 PM"];

    const filteredTimes = [];
    rawTimes.forEach(t => {
        let [time, modifier] = t.split(' ');
        let [hours, mins] = time.split(':');
        hours = parseInt(hours, 10);
        mins = parseInt(mins, 10);
        if (modifier === 'PM' && hours < 12) hours += 12;
        if (modifier === 'AM' && hours === 12) hours = 0;

        // Slot Limit Logic (Max 4 bookings per 15-min slot block represented by the hour)
        const slotKey = `${selectedDateStr}_${t}`;
        const count = bookedSlots[botType][slotKey] || 0;
        if (count >= 4) return; // Exclude full slots

        if (isToday) {
            if (hours > currentHour || (hours === currentHour && mins > currentMin)) {
                filteredTimes.push(t);
            }
        } else {
            filteredTimes.push(t);
        }
    });
    return filteredTimes;
}

// Helper: Calculate Exact Timestamp for Reminders
function getApptTimestamp(dateStr, timeStr) {
    const dateObj = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    if (dateStr === 'Tomorrow') {
        dateObj.setDate(dateObj.getDate() + 1);
    }
    let [time, modifier] = timeStr.split(' ');
    let [hours, mins] = time.split(':');
    hours = parseInt(hours, 10);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    dateObj.setHours(hours, parseInt(mins, 10), 0, 0);
    return dateObj.getTime();
}

// ==========================================
// 🚀 1. TELEGRAM BOT SETUP (ORIGINAL SHAHID CREATIVES)
// ==========================================
const TELEGRAM_TOKEN = '8563313484:AAHo9aqVSETs4aXntUXn01yIuHN3OdzxTq8';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// 🛠️ FIX FOR 409 CONFLICT ERROR
bot.on('polling_error', (error) => {
    console.log("Original Telegram Polling Error (Ignored to prevent crash):", error.message);
});

// Telegram - Handling Callback Queries for Consultation Buttons
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;

    if (data.startsWith('cons_time_')) {
        const selectedTime = data.replace('cons_time_', '');
        // Route this to processUnifiedMessage as a text message so the existing flow works!
        await processUnifiedMessage(chatId, `Custom Time: ${selectedTime}`, 'telegram');
        bot.answerCallbackQuery(query.id);
    }
    // 🟢 NEW: Route UI button selections seamlessly to the text mapping engine
    else if (data.startsWith('sel_web_') || data.startsWith('sel_ai_')) {
        const number = data.split('_')[2];
        await processUnifiedMessage(chatId, number, 'telegram');
        bot.answerCallbackQuery(query.id);
    }
});

// Telegram - Handling User Inputs & Routing to Master Engine
bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    if (!text) return; // Ignore non-text messages (photos, etc.)

    // Pass the message to the Unified Master Engine
    await processUnifiedMessage(chatId, text, 'telegram');
});


// ==========================================
// ✨ NEW: SALON AI VIRTUAL RECEPTIONIST BOT (PREMIUM UPGRADE)
// ==========================================
const SALON_TELEGRAM_TOKEN = '8602924285:AAGRgdN8F6pr5BhzCysFaM8uXoXNo93gyeY';
const salonBot = new TelegramBot(SALON_TELEGRAM_TOKEN, { polling: true });
const SALON_ADMIN_CHAT_ID = '8885973325'; // 🚨 ADMIN CHAT ID SET HERE

salonBot.on('polling_error', (error) => {
    console.log("Salon Bot Polling Error:", error.message);
});

// Lightweight memory for Salon Bot
const salonSessions = {};
let salonAdminState = null; // To track admin reschedule targets

// 🟢 ADMIN & USER INLINE BUTTON HANDLER (SALON)
salonBot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;
    const messageId = query.message.message_id;

    // 1. ADMIN ACTIONS (Confirm or Reschedule)
    if (chatId === SALON_ADMIN_CHAT_ID && data.startsWith('admin_sln_')) {
        const parts = data.split('_'); 
        const action = parts[2]; // confirm / resched
        const clientChatId = parts[3]; // user's chat id

        if (action === 'confirm') {
            await salonBot.editMessageText(query.message.text + "\n\n✅ *STATUS: BOOKING CONFIRMED BY YOU*", { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
            await salonBot.sendMessage(clientChatId, "🎉 *Great News!*\n\nYour appointment has been *CONFIRMED* by the salon. Hum aapka intezaar kar rahe hain! ✨\n\n🌐 _Powered by Shahid Creatives_", { parse_mode: "Markdown" });
        } else if (action === 'resched') {
            salonAdminState = clientChatId; // Store which client admin is replying to
            await salonBot.editMessageText(query.message.text + "\n\n🔄 *STATUS: PENDING TIME UPDATE*", { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
            await salonBot.sendMessage(chatId, `⚠️ Aapne Client (${clientChatId}) ke liye *Reschedule* chuna hai.\n\n👉 *Kripya naya Time ya Message type karke bhejein:*\n_(Yeh message seedha client ko bhej diya jayega)_`, { parse_mode: "Markdown" });
        }
        return salonBot.answerCallbackQuery(query.id);
    }

    // 2. USER ACTIONS (Language, Service, Date & Time Buttons)
    if (!salonSessions[chatId]) salonSessions[chatId] = { step: 'start' };
    const session = salonSessions[chatId];

    // LANGUAGE SELECTION
    if (data === 'sln_lang_en' || data === 'sln_lang_hin') {
        session.lang = data === 'sln_lang_en' ? 'EN' : 'HIN';
        session.step = 'AWAITING_SERVICE_BTN';

        const isEn = session.lang === 'EN';
        const greetingMsg = isEn 
            ? "Hello! Welcome to *Fit hair artist Unisex Family Salon*! ✨\n\nWe are Mohali's top-rated 4.9-star salon. 💇‍♀️\n📞 Support Help Line: *+91 7529839762*\n\n🔥 *Current Special Offers (Valid for ANY LENGTH of hair):*\n\nWhich service are you looking for today? 👇\n*(Please click an option below)*"
            : "Namaste! *Fit hair artist Unisex Family Salon* mein aapka swagat hai! ✨\n\nHum Mohali ke top-rated 4.9-star salon hain. 💇‍♀️\n📞 Support Help Line: *+91 7529839762*\n\n🔥 *Current Special Offers (Valid for ANY LENGTH of hair):*\n\nAap aaj kaunsi service dekh rahe hain? 👇\n*(Kripya niche diye gaye options par click karein)*";

        const serviceOpts = {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔹 Smoothing: ₹2499", callback_data: "srv_smoothing" }],
                    [{ text: "🔹 Keratin: ₹1999", callback_data: "srv_keratin" }],
                    [{ text: "🔹 Botox: ₹2999", callback_data: "srv_botox" }],
                    [{ text: "🔹 Nanoplastia: ₹3999", callback_data: "srv_nanoplastia" }],
                    [{ text: "🌐 Powered by Shahid Creatives", url: "https://shahidcreatives.com" }]
                ]
            }
        };
        await salonBot.editMessageText(greetingMsg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: serviceOpts.reply_markup });
    }
    // SERVICE SELECTION BUTTONS
    else if (data.startsWith('srv_')) {
        const serviceChoice = data.split('_')[1];
        session.step = 'AWAITING_DATE_BTN';
        const isEn = session.lang === 'EN';
        
        let priceReply = "";
        if (serviceChoice === 'smoothing') { priceReply = isEn ? "Excellent! *Smoothing* is available at just ₹2499 (Any Length)." : "Behtareen! *Smoothing* sirf ₹2499 mein available hai (Kisi bhi length ke liye)."; session.service = "Smoothing"; session.price = "₹2499"; }
        else if (serviceChoice === 'keratin') { priceReply = isEn ? "Excellent! *Keratin* is available at just ₹1999 (Any Length)." : "Behtareen! *Keratin* sirf ₹1999 mein available hai (Kisi bhi length ke liye)."; session.service = "Keratin"; session.price = "₹1999"; }
        else if (serviceChoice === 'botox') { priceReply = isEn ? "Excellent! *Botox* is available at just ₹2999 (Any Length)." : "Behtareen! *Botox* sirf ₹2999 mein available hai (Kisi bhi length ke liye)."; session.service = "Botox"; session.price = "₹2999"; }
        else if (serviceChoice === 'nanoplastia') { priceReply = isEn ? "Excellent! *Nanoplastia* is available at just ₹3999 (Any Length)." : "Behtareen! *Nanoplastia* sirf ₹3999 mein available hai (Kisi bhi length ke liye)."; session.service = "Nanoplastia"; session.price = "₹3999"; }

        const datePrompt = isEn ? "\n\nPlease select your preferred *Date*: 👇" : "\n\nKripya apna preferred *Date* select karein: 👇";
        const dateOptions = {
            inline_keyboard: [
                [{ text: "📅 Today", callback_data: "date_today" }, { text: "📅 Tomorrow", callback_data: "date_tomorrow" }]
            ]
        };
        
        await salonBot.editMessageText(`${priceReply}${datePrompt}`, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: dateOptions });
    }
    // DATE SELECTION BUTTONS
    else if (data.startsWith('date_')) {
        session.date = data === 'date_today' ? 'Today' : 'Tomorrow';
        session.step = 'AWAITING_TIME_BTN';
        const isEn = session.lang === 'EN';

        const filteredTimes = getAvailableTimes('salon', session.date);
        
        if (filteredTimes.length === 0) {
            const noTimeMsg = isEn ? `Sorry, all slots for **${session.date}** are fully booked or the time has passed. Please select 'Tomorrow'.` : `Maafi chahte hain, **${session.date}** ke sabhi slots book ho chuke hain ya samay nikal chuka hai. Kripya 'Tomorrow' select karein.`;
            return salonBot.editMessageText(noTimeMsg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
        }

        const timeButtons = [];
        let row = [];
        filteredTimes.forEach((time, index) => {
            row.push({ text: `⏰ ${time}`, callback_data: `time_${time}` });
            if (row.length === 3 || index === filteredTimes.length - 1) { 
                timeButtons.push(row);
                row = [];
            }
        });

        const timePrompt = isEn 
            ? `You have selected *${session.date}*.\n\nNow please choose your preferred *Time Slot*: 👇`
            : `Aapne *${session.date}* select kiya hai.\n\nAb kripya apna preferred *Time Slot* choose karein: 👇`;

        await salonBot.editMessageText(timePrompt, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: timeButtons } });
    }
    // TIME SELECTION BUTTONS -> GOES TO SPECIALIST
    else if (data.startsWith('time_')) {
        session.time = data.replace('time_', '');
        session.dateTime = `${session.date} at ${session.time}`;
        session.step = 'AWAITING_SPECIALIST';
        const isEn = session.lang === 'EN';
        
        const specPrompt = isEn
            ? `Perfect! Slot for *${session.dateTime}* noted.\n\nPlease select your preferred Hair Specialist: 👇`
            : `Perfect! *${session.dateTime}* slot note ho gaya.\n\nApne preferred Hair Specialist chunein: 👇`;
            
        const specOptions = {
            inline_keyboard: [
                [{ text: "💇‍♂️ Imran (Senior Stylist)", callback_data: "sln_spec_Imran" }],
                [{ text: "💇‍♀️ Rahul (Color Expert)", callback_data: "sln_spec_Rahul" }],
                [{ text: "✨ Any Available Specialist", callback_data: "sln_spec_Any" }]
            ]
        };

        await salonBot.editMessageText(specPrompt, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: specOptions });
    }
    // SPECIALIST SELECTION -> GOES TO PRE-DETAILS
    else if (data.startsWith('sln_spec_')) {
        session.specialist = data.replace('sln_spec_', '');
        session.step = 'AWAITING_HAIRSTYLE_DETAILS';
        const isEn = session.lang === 'EN';
        
        const detailsPrompt = isEn
            ? `You selected: *${session.specialist}*\n\nPlease describe what specific hairstyle or improvement you need (e.g., Party styling, Hairfall treatment, Highlight touchup): ✍️`
            : `Aapne chuna hai: *${session.specialist}*\n\nKripya batayein aapko kis tarah ki hairstyle ya improvement chahiye (jaise: Party styling, Hairfall treatment): ✍️`;
        
        await salonBot.editMessageText(detailsPrompt, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
    }

    salonBot.answerCallbackQuery(query.id);
});

// 🟢 USER MESSAGES ROUTER (SALON)
salonBot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    let text = msg.text;
    if (msg.contact) { text = msg.contact.phone_number; }
    if (!text) return; 

    // 🚨 ADMIN TIME UPDATE ROUTING
    if (chatId === SALON_ADMIN_CHAT_ID && salonAdminState) {
        const clientChatId = salonAdminState;
        const clientLang = salonSessions[clientChatId] ? salonSessions[clientChatId].lang : 'HIN';
        const isEn = clientLang === 'EN';

        const updateMsg = isEn 
            ? `⚠️ *Update from Salon*\n\nSorry, your previous slot is unavailable. The Admin has set a new time for you:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`
            : `⚠️ *Update from Salon / Salon se Sandesh*\n\nMaafi chahte hain, aapka purana slot available nahi hai. Admin ne aapka naya samay tay kiya hai:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`;
        
        await salonBot.sendMessage(clientChatId, updateMsg, { parse_mode: 'Markdown' });
        await salonBot.sendMessage(chatId, `✅ Update sent successfully to Client!`, { parse_mode: 'Markdown' });
        salonAdminState = null; // Clear state
        return;
    }

    const lowerText = text.toLowerCase();
    const resetTriggers = ['hi', 'hello', 'hey', 'start', '/start', 'menu'];

    // 1. LANGUAGE SELECTION TRIGGER
    if (!salonSessions[chatId] || resetTriggers.includes(lowerText)) {
        salonSessions[chatId] = { step: 'language_selection' };
        
        const langPrompt = "👋 *Welcome! / Swagat hai!*\n\nPlease select your preferred language:\nKripya apni bhasha chunein:";
        const langOpts = {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🇬🇧 English", callback_data: "sln_lang_en" }, { text: "🇮🇳 Hinglish", callback_data: "sln_lang_hin" }]
                ]
            }
        };
        return salonBot.sendMessage(chatId, langPrompt, langOpts);
    }

    const session = salonSessions[chatId];
    const step = session.step;
    const isEn = session.lang === 'EN';

    // CONSTRAINTS
    if (step === 'AWAITING_SERVICE_BTN') return salonBot.sendMessage(chatId, isEn ? "Please select a service using the buttons above. 👇" : "Kripya upar diye gaye buttons par click karke apni service select karein. 👇");
    if (step === 'AWAITING_DATE_BTN') return salonBot.sendMessage(chatId, isEn ? "Please click the Date buttons (Today/Tomorrow) above. 👇" : "Kripya Date select karne ke liye upar diye gaye (Today/Tomorrow) buttons par click karein. 👇");
    if (step === 'AWAITING_TIME_BTN') return salonBot.sendMessage(chatId, isEn ? "Please select your Time Slot from the buttons above. 👇" : "Kripya Time select karne ke liye upar diye gaye Time Slot buttons par click karein. 👇");
    if (step === 'AWAITING_SPECIALIST') return salonBot.sendMessage(chatId, isEn ? "Please select your preferred Specialist from the buttons above. 👇" : "Kripya Specialist select karne ke liye upar diye gaye buttons par click karein. 👇");

    // HAIRSTYLE DETAILS COLLECTED -> ASK NAME
    if (step === 'AWAITING_HAIRSTYLE_DETAILS') {
        session.hairstyleDetails = text;
        session.step = 'COLLECT_NAME';
        const namePrompt = isEn ? `Noted! Now please type and send your Full Name. ✨` : `Noted! Ab kripya apna Full Name type karke bhejein. ✨`;
        return salonBot.sendMessage(chatId, namePrompt, { parse_mode: "Markdown" });
    }

    // 3. BOOKING PROCESS - NAME
    if (step === 'COLLECT_NAME') {
        session.name = text;
        session.step = 'COLLECT_PHONE';
        
        const contactOpts = {
            reply_markup: {
                keyboard: [[{ text: isEn ? "📱 Share Contact Number" : "📱 Contact Number Share Karein", request_contact: true }]],
                one_time_keyboard: true, resize_keyboard: true
            }
        };
        const phonePrompt = isEn 
            ? `Thank you ${session.name}! Last step, please click the button below to share your verified Contact Number. 👇`
            : `Shukriya ${session.name}! Last step, apna verified Contact Number share karne ke liye niche button par click karein. 👇`;

        return salonBot.sendMessage(chatId, phonePrompt, contactOpts);
    }

    // 4. CONFIRMATION & ADMIN ALERT ENGINE
    if (step === 'COLLECT_PHONE') {
        session.phone = text; 
        session.step = 'COMPLETED';

        // Add to booked slots (Max 4 tracking)
        const slotKey = `${session.date}_${session.time}`;
        bookedSlots.salon[slotKey] = (bookedSlots.salon[slotKey] || 0) + 1;

        // Calculate precise offset so past reminders automatically toggle true and skip
        const apptTimestamp = getApptTimestamp(session.date, session.time);
        const diffMs = apptTimestamp - Date.now();
        const diffHoursInitial = diffMs / (1000 * 60 * 60);

        // Schedule Reminder (10h, 2h, 1h)
        activeAppointments.push({
            bot: 'salon', chatId, lang: session.lang,
            timestamp: apptTimestamp,
            clientName: session.name,
            reminded: { 
                '10': diffHoursInitial <= 10, // Avoid firing 10h reminder if booked under 10h 
                '2': diffHoursInitial <= 2,   // Avoid firing 2h reminder if booked under 2h
                '1': diffHoursInitial <= 1    // Avoid firing 1h reminder if booked under 1h
            }
        });
        
        // 🟢 PROFESSIONAL SALON RECEIPT FORMATTING (WITH MAP & SPECIALIST)
        const receiptMsg = isEn 
            ? `🎉 *Booking Request Sent!*\n\nHello *${session.name}*, your appointment request has been successfully received.\n\n🧾 *Booking Summary:*\n📅 *Date & Time:* ${session.dateTime}\n💇‍♀️ *Service:* ${session.service}\n💰 *Price:* ${session.price}\n👨‍🎨 *Specialist:* ${session.specialist}\n\n👤 *Client Details:*\n   ▫️ *Name:* ${session.name}\n   ▫️ *Contact:* ${session.phone}\n   ▫️ *Pre-details:* ${session.hairstyleDetails}\n\n📍 *Location:* Phase 11, Mohali\n🗺️ *GPS Location:* [Navigate Here](https://www.google.com/maps/dir//Ground+Floor,+Fit+hair+artist+Unisex+Family+Salon,+SCO+50,+Phase+11,+Sector+65,+Sahibzada+Ajit+Singh+Nagar,+Punjab+160062/@30.6811159,76.7420617,822m/data=!3m1!1e3!4m17!1m7!3m6!1s0x390fed26d2a12c33:0xbc77237be76b2e81!2sFit+hair+artist+Unisex+Family+Salon!8m2!3d30.6811113!4d76.744642!16s%2Fg%2F11wtm3plgb!4m8!1m0!1m5!1m1!1s0x390fed26d2a12c33:0xbc77237be76b2e81!2m2!1d76.744642!2d30.6811113!3e0?entry=ttu&g_ep=EgoyMDI2MDcxNS4wIKXMDSoASAFQAw%3D%3D)\n\n_Our team will contact you shortly for final confirmation._ ✨\n\n🌐 _Powered by Shahid Creatives_`
            : `🎉 *Booking Request Sent!*\n\nNamaste *${session.name}*, aapki appointment request successfully receive ho gayi hai.\n\n🧾 *Booking Summary:*\n📅 *Date & Time:* ${session.dateTime}\n💇‍♀️ *Service:* ${session.service}\n💰 *Price:* ${session.price}\n👨‍🎨 *Specialist:* ${session.specialist}\n\n👤 *Client Details:*\n   ▫️ *Name:* ${session.name}\n   ▫️ *Contact:* ${session.phone}\n   ▫️ *Pre-details:* ${session.hairstyleDetails}\n\n📍 *Location:* Phase 11, Mohali\n🗺️ *GPS Location:* [Navigate Here](https://www.google.com/maps/dir//Ground+Floor,+Fit+hair+artist+Unisex+Family+Salon,+SCO+50,+Phase+11,+Sector+65,+Sahibzada+Ajit+Singh+Nagar,+Punjab+160062/@30.6811159,76.7420617,822m/data=!3m1!1e3!4m17!1m7!3m6!1s0x390fed26d2a12c33:0xbc77237be76b2e81!2sFit+hair+artist+Unisex+Family+Salon!8m2!3d30.6811113!4d76.744642!16s%2Fg%2F11wtm3plgb!4m8!1m0!1m5!1m1!1s0x390fed26d2a12c33:0xbc77237be76b2e81!2m2!1d76.744642!2d30.6811113!3e0?entry=ttu&g_ep=EgoyMDI2MDcxNS4wIKXMDSoASAFQAw%3D%3D)\n\n_Humari team jald hi aapse final confirmation ke liye sampark karegi._ ✨\n\n🌐 _Powered by Shahid Creatives_`;
        
        salonBot.sendMessage(chatId, receiptMsg, { parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: { remove_keyboard: true } });

        // 🚨 ALERT TO ADMIN (Includes TG Chat ID)
        const adminAlertMsg = `🚨 *NEW SALON LEAD ALERT!* 🚨\n\n👤 *Name:* ${session.name}\n📱 *Number:* \`${session.phone}\`\n💬 *Telegram Chat ID:* ${chatId}\n💇‍♀️ *Service:* ${session.service}\n👨‍🎨 *Specialist:* ${session.specialist}\n📅 *Slot Requested:* ${session.dateTime}\n📝 *Pre-details:* ${session.hairstyleDetails}\n\n*Action Required:*`;
        
        const adminOptions = {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Confirm Booking", callback_data: `admin_sln_confirm_${chatId}` }],
                    [{ text: "🔄 Reschedule / Update Time", callback_data: `admin_sln_resched_${chatId}` }]
                ]
            }
        };

        return salonBot.sendMessage(SALON_ADMIN_CHAT_ID, adminAlertMsg, adminOptions);
    }
    
    if (step === 'COMPLETED') {
        return salonBot.sendMessage(chatId, isEn ? "Your appointment is already processed! Type 'Hi' to start over. ✨" : "Aapka appointment process ho chuka hai! Naya book karne ke liye 'Hi' bhejein. ✨");
    }
});


// ==========================================
// ✨ NEW: ZAM ZAM CLINIC VIRTUAL RECEPTIONIST BOT (PREMIUM)
// ==========================================
const ZAMZAM_TELEGRAM_TOKEN = '8707737273:AAEIKAFSF4pxb3gKnbQTNZVxhwEKaYE_mE0';
const zamZamBot = new TelegramBot(ZAMZAM_TELEGRAM_TOKEN, { polling: true });
const ZAMZAM_ADMIN_CHAT_ID = '8885973325'; // 🚨 ADMIN CHAT ID SET HERE

zamZamBot.on('polling_error', (error) => {
    console.log("Zam Zam Bot Polling Error:", error.message);
});

// Lightweight memory for Zam Zam Bot
const zamzamSessions = {};
let zamzamAdminState = null; // To track admin reschedule targets

// 1. Handle Button Clicks (Callback Queries)
zamZamBot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id.toString();
    const data = query.data;
    const messageId = query.message.message_id;

    // 🚨 ADMIN ACTIONS (Confirm or Reschedule)
    if (chatId === ZAMZAM_ADMIN_CHAT_ID && data.startsWith('admin_zz_')) {
        const parts = data.split('_'); 
        const action = parts[2]; // confirm / resched
        const clientChatId = parts[3]; 

        if (action === 'confirm') {
            await zamZamBot.editMessageText(query.message.text + "\n\n✅ *STATUS: BOOKING CONFIRMED BY YOU*", { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
            await zamZamBot.sendMessage(clientChatId, "🎉 *Great News!*\n\nAapki appointment Clinic dwara *CONFIRM* kar di gayi hai. Kripya samay par pahuchein! 🩺\n\n🌐 _Powered by Shahid Creatives_", { parse_mode: "Markdown" });
        } else if (action === 'resched') {
            zamzamAdminState = clientChatId; 
            await zamZamBot.editMessageText(query.message.text + "\n\n🔄 *STATUS: PENDING TIME UPDATE*", { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
            await zamZamBot.sendMessage(chatId, `⚠️ Aapne Patient (${clientChatId}) ke liye *Reschedule/Update Time* chuna hai.\n\n👉 *Kripya naya Time ya Message type karke bhejein:*\n_(Yeh message seedha patient ko bhej diya jayega)_`, { parse_mode: "Markdown" });
        }
        return zamZamBot.answerCallbackQuery(query.id);
    }

    if (!zamzamSessions[chatId]) zamzamSessions[chatId] = { step: 'start', lang: 'HIN' };
    const session = zamzamSessions[chatId];
    const isEn = session.lang === 'EN';

    // 🟢 LANGUAGE SET & SHOW WELCOME
    if (data === 'zz_lang_en' || data === 'zz_lang_hin') {
        session.lang = data === 'zz_lang_en' ? 'EN' : 'HIN';
        const updatedIsEn = session.lang === 'EN';

        const welcomeMessage = updatedIsEn 
            ? `👋 *Hello! Welcome to Zam Zam Clinic.*\n\nI am your Virtual Assistant. We offer the best medical care.\n📞 Support Help Line: *+91 7529839762*\n\nPlease select an option below:`
            : `👋 *Namaste! Zam Zam Clinic mein aapka swagat hai.*\n\nMain aapka Virtual Assistant hoon. Yahan behtareen chikitsa di jati hai.\n📞 Support Help Line: *+91 7529839762*\n\nKripya niche diye gaye options mein se chunein:`;

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: updatedIsEn ? '📅 Book Appointment' : '📅 Book Appointment', callback_data: 'book' }],
                    [{ text: updatedIsEn ? '🕒 Clinic Timings' : '🕒 Clinic Timings', callback_data: 'timings' }, { text: updatedIsEn ? '📍 Location' : '📍 Location', callback_data: 'location' }],
                    [{ text: updatedIsEn ? '🩺 Our Services' : '🩺 Our Services', callback_data: 'services' }, { text: updatedIsEn ? '📞 Contact' : '📞 Contact', callback_data: 'contact' }],
                    [{ text: '🌐 Powered by Shahid Creatives', url: 'https://shahidcreatives.com' }]
                ]
            }
        };
        await zamZamBot.editMessageText(welcomeMessage, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown', reply_markup: options.reply_markup });
    }
    // 🟢 MENUS
    else if (data === 'timings') {
        const timingMsg = isEn 
            ? `🕒 *Zam Zam Clinic - Timings*\n\n🌅 *Morning:* 8:00 AM - 2:00 PM\n🌆 *Evening:* 4:00 PM - 10:00 PM\n_Monday to Sunday_`
            : `🕒 *Zam Zam Clinic - Timings*\n\n🌅 *Subah:* 8:00 AM se 2:00 PM\n🌆 *Shaam:* 4:00 PM se 10:00 PM\n_Monday to Sunday_`;
        zamZamBot.sendMessage(chatId, timingMsg, { parse_mode: 'Markdown' });
    } 
    else if (data === 'location') {
        const locMsg = isEn 
            ? `📍 *Zam Zam Clinic - Address*\n\nStreet Number 1, Wall Singh Nagar Rd, Barsal Nagar, Bal Singh Nagar, Ludhiana, Punjab 141007\n\n🗺️ *Map:* [View on Google Maps](https://www.google.com/maps/search/?api=1&query=Zam%20Zam%20Clinic&query_place_id=ChIJ6YeKEnuDGjkRKeQcbhpwlWI)`
            : `📍 *Zam Zam Clinic - Address*\n\nStreet Number 1, Wall Singh Nagar Rd, Barsal Nagar, Bal Singh Nagar, Ludhiana, Punjab 141007\n\n🗺️ *Map:* [Google Maps Par Dekhein](https://www.google.com/maps/search/?api=1&query=Zam%20Zam%20Clinic&query_place_id=ChIJ6YeKEnuDGjkRKeQcbhpwlWI)`;
        zamZamBot.sendMessage(chatId, locMsg, { parse_mode: 'Markdown', disable_web_page_preview: true });
    } 
    else if (data === 'services') {
        const srvMsg = isEn 
            ? `🩺 *Our Medical Services*\n\n*General Care*:\n🔹 General OPD (Cold, Cough, Fever)\n🔹 Blood Pressure (BP) & Sugar Checkup\n🔹 First Aid & Minor Injuries\n🔹 Pain Management`
            : `🩺 *Humari Medical Services*\n\n*General Care*:\n🔹 General OPD (Sardi, Khasi, Bukhar)\n🔹 Blood Pressure (BP) & Sugar Checkup\n🔹 First Aid & Minor Injuries\n🔹 Pain Management`;
        zamZamBot.sendMessage(chatId, srvMsg, { parse_mode: 'Markdown' });
    } 
    else if (data === 'contact') {
        const contactMsg = isEn 
            ? `📞 *Contact & Support*\n\nFor any info or emergency, contact us:\n\n📱 *Help Line:* +91 7529839762`
            : `📞 *Contact & Support*\n\nKisi bhi jankari ya emergency ke liye aap sampark kar sakte hain:\n\n📱 *Help Line:* +91 7529839762`;
        zamZamBot.sendMessage(chatId, contactMsg, { parse_mode: 'Markdown' });
    } 
    
    // 🟢 DATE SELECTION FOR CLINIC
    else if (data === 'book') {
        session.step = 'AWAITING_DATE';
        const dateOptions = {
            inline_keyboard: [
                [{ text: "📅 Today", callback_data: "zz_date_today" }, { text: "📅 Tomorrow", callback_data: "zz_date_tomorrow" }]
            ]
        }
        const dateMsg = isEn 
            ? `📅 *Appointment Booking:*\n\nPlease select your preferred *Date* first: 👇`
            : `📅 *Appointment Booking:*\n\nKripya pehle preferred *Date* select karein: 👇`;
        zamZamBot.sendMessage(chatId, dateMsg, { parse_mode: 'Markdown', reply_markup: dateOptions });
    }
    
    // 🟢 TIME SELECTION FOR CLINIC
    else if (data.startsWith('zz_date_')) {
        session.date = data === 'zz_date_today' ? 'Today' : 'Tomorrow';
        session.step = 'AWAITING_TIME';

        const filteredTimes = getAvailableTimes('clinic', session.date);

        if (filteredTimes.length === 0) {
            const noTimeMsg = isEn ? `Sorry, all slots for **${session.date}** are fully booked or the time has passed. Please select 'Tomorrow'.` : `Maafi chahte hain, **${session.date}** ke sabhi slots book ho chuke hain ya samay nikal chuka hai. Kripya 'Tomorrow' select karein.`;
            return zamZamBot.editMessageText(noTimeMsg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
        }

        const timeButtons = [];
        let row = [];
        filteredTimes.forEach((time, index) => {
            row.push({ text: `⏰ ${time}`, callback_data: `zz_time_${time}` });
            if (row.length === 2 || index === filteredTimes.length - 1) { 
                timeButtons.push(row);
                row = [];
            }
        });

        const timeMsg = isEn
            ? `You selected *${session.date}*.\n\nNow please choose a clinic *Time Slot*: 👇`
            : `Aapne *${session.date}* select kiya hai.\n\nAb kripya clinic ka preferred *Time Slot* choose karein: 👇`;
        
        zamZamBot.editMessageText(timeMsg, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: { inline_keyboard: timeButtons } });
    }

    // 🟢 DOCTOR SELECTION FOR CLINIC
    else if (data.startsWith('zz_time_')) {
        session.time = data.replace('zz_time_', '');
        session.step = 'AWAITING_DOCTOR';
        
        const docPrompt = isEn ? `Please select your preferred Doctor: 👇` : `Kripya apne Doctor select karein: 👇`;
        const docOptions = {
            inline_keyboard: [
                [{ text: "👨‍⚕️ Dr. Munna Bengali (Gen Physician)", callback_data: "zz_doc_Munna" }],
                [{ text: "👨‍⚕️ Dr. Shahid (Skin Specialist)", callback_data: "zz_doc_Shahid" }],
                [{ text: "👩‍⚕️ Dr. Sana (Gynaecologist)", callback_data: "zz_doc_Sana" }]
            ]
        };
        zamZamBot.editMessageText(docPrompt, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown", reply_markup: docOptions });
    }

    // 🟢 PROBLEM DETAILS COLLECTION
    else if (data.startsWith('zz_doc_')) {
        session.doctor = data.replace('zz_doc_', '');
        session.step = 'AWAITING_PROBLEM_DETAILS';
        const isEn = session.lang === 'EN';
        
        const probPrompt = isEn 
            ? `Doctor selected: *Dr. ${session.doctor}*\n\nPlease briefly describe your problem and since when you are facing it. ✍️\n_(Example: Fever and headache since 2 days)_`
            : `Doctor selected: *Dr. ${session.doctor}*\n\nKripya batayein aapko kya problem hai aur kitne time se hai. ✍️\n_(Udaharan: 2 din se bukhar aur sir dard)_`;
            
        zamZamBot.editMessageText(probPrompt, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
    }

    zamZamBot.answerCallbackQuery(query.id);
});

// 3. Handle Messages & Admin Alert Logic (Zam Zam)
zamZamBot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    if (!text) return;

    // 🚨 ADMIN TIME UPDATE ROUTING (CLINIC)
    if (chatId === ZAMZAM_ADMIN_CHAT_ID && zamzamAdminState) {
        const clientChatId = zamzamAdminState;
        const clientLang = zamzamSessions[clientChatId] ? zamzamSessions[clientChatId].lang : 'HIN';
        const isEn = clientLang === 'EN';

        const updateMsg = isEn 
            ? `⚠️ *Update from Clinic*\n\nSorry, your previous slot is unavailable. The Doctor/Admin has set a new time for you:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`
            : `⚠️ *Update from Clinic / Clinic se Sandesh*\n\nMaafi chahte hain, aapka purana slot available nahi hai. Doctor/Admin ne aapka naya samay tay kiya hai:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`;
        
        await zamZamBot.sendMessage(clientChatId, updateMsg, { parse_mode: 'Markdown' });
        await zamZamBot.sendMessage(chatId, `✅ Update sent successfully to Patient!`, { parse_mode: 'Markdown' });
        zamzamAdminState = null; // Clear state
        return;
    }

    const lowerText = text.toLowerCase();
    const triggers = ['hi', 'hello', 'hey', 'start', '/start', 'menu'];

    // 🟢 HI/HELLO TRIGGER - SHOW LANGUAGE MENU
    if (!zamzamSessions[chatId] || triggers.includes(lowerText)) {
        zamzamSessions[chatId] = { step: 'language_selection' };
        const langPrompt = "👋 *Welcome! / Swagat hai!*\n\nPlease select your preferred language:\nKripya apni bhasha chunein:";
        const langOpts = {
            parse_mode: "Markdown",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🇬🇧 English", callback_data: "zz_lang_en" }, { text: "🇮🇳 Hinglish", callback_data: "zz_lang_hin" }]
                ]
            }
        };
        return zamZamBot.sendMessage(chatId, langPrompt, langOpts);
    }

    const session = zamzamSessions[chatId];
    const isEn = session.lang === 'EN';

    // PATIENT PROBLEM COLLECTED -> ASK DETAILS
    if (session.step === 'AWAITING_PROBLEM_DETAILS') {
        session.problem = text;
        session.step = 'COLLECT_DETAILS';
        
        const detailsMsg = isEn 
            ? `Noted!\n\nNow please type and send your *Name, Age, Gender, and Mobile Number* separated by commas.\n\n_(Example: Shahid Alam, 30, Male, 9097617846)_`
            : `Noted!\n\nAb kripya apna *Naam, Umar (Age), Gender, aur Mobile Number* ek hi message mein comma lagakar bhejein.\n\n_(Udaharan: Shahid Alam, 30, Male, 9097617846)_`;

        return zamZamBot.sendMessage(chatId, detailsMsg, { parse_mode: "Markdown" });
    }

    // Agar user details collection state mein hai
    if (session && session.step === 'COLLECT_DETAILS') {
        const userName = msg.from.first_name || 'User';
        const userUsername = msg.from.username ? `@${msg.from.username}` : 'No Username';

        // 🟢 PROFESSIONAL CLINIC RECEIPT FORMATTING & SMART PARSING
        let detailsArr = text.split(/[,|\n]+/).map(s => s.trim());
        let formattedPatientDetails = "";
        
        if (detailsArr.length >= 3) {
            formattedPatientDetails = `\n   ▫️ *Name:* ${detailsArr[0]}\n   ▫️ *Age:* ${detailsArr[1]}`;
            if (detailsArr.length >= 4) {
                 formattedPatientDetails += `\n   ▫️ *Gender:* ${detailsArr[2]}\n   ▫️ *Mobile:* ${detailsArr[3]}`;
            } else {
                 formattedPatientDetails += `\n   ▫️ *Mobile:* ${detailsArr[2]}`;
            }
        } else {
            formattedPatientDetails = `\n   ▫️ *Info:* ${text}`;
        }

        // Add to booked slots (Max 4 tracking)
        const slotKey = `${session.date}_${session.time}`;
        bookedSlots.clinic[slotKey] = (bookedSlots.clinic[slotKey] || 0) + 1;

        // Calculate precise offset so past reminders automatically toggle true and skip
        const apptTimestamp = getApptTimestamp(session.date, session.time);
        const diffMs = apptTimestamp - Date.now();
        const diffHoursInitial = diffMs / (1000 * 60 * 60);

        // Schedule Reminder (10h, 2h, 1h)
        activeAppointments.push({
            bot: 'clinic', chatId, lang: session.lang,
            timestamp: apptTimestamp,
            clientName: (detailsArr[0] || userName),
            reminded: { 
                '10': diffHoursInitial <= 10, // Avoid firing 10h reminder if booked under 10h 
                '2': diffHoursInitial <= 2,   // Avoid firing 2h reminder if booked under 2h
                '1': diffHoursInitial <= 1    // Avoid firing 1h reminder if booked under 1h
            }
        });

        // Receipt Generation with Maps Link
        const clientReceipt = isEn 
            ? `🎉 *Appointment Request Sent!*\n\nHello *${userName}*, your appointment request has been successfully received.\n\n🧾 *Booking Summary:*\n📅 *Date:* ${session.date}\n⏰ *Time:* ${session.time}\n👨‍⚕️ *Doctor:* Dr. ${session.doctor}\n👤 *Patient Details:*${formattedPatientDetails}\n📝 *Current Problem:* ${session.problem}\n💰 *Clinic Appoint Fee:* 500/- INR\n📍 *Location:* Zam Zam Clinic\n🗺️ *GPS Location:* [Navigate Here](https://www.google.com/maps/search/?api=1&query=Zam%20Zam%20Clinic&query_place_id=ChIJ6YeKEnuDGjkRKeQcbhpwlWI)\n\nOur team will contact you shortly for final confirmation. 🙏\n\n🌐 _Powered by Shahid Creatives_`
            : `🎉 *Appointment Request Sent!*\n\nNamaste *${userName}*, aapki appointment request successfully receive ho gayi hai.\n\n🧾 *Booking Summary:*\n📅 *Date:* ${session.date}\n⏰ *Time:* ${session.time}\n👨‍⚕️ *Doctor:* Dr. ${session.doctor}\n👤 *Patient Details:*${formattedPatientDetails}\n📝 *Current Problem:* ${session.problem}\n💰 *Clinic Appoint Fee:* 500/- INR\n📍 *Location:* Zam Zam Clinic\n🗺️ *GPS Location:* [Navigate Here](https://www.google.com/maps/search/?api=1&query=Zam%20Zam%20Clinic&query_place_id=ChIJ6YeKEnuDGjkRKeQcbhpwlWI)\n\nHumari team jald hi aapse final confirmation ke liye sampark karegi. Kripya samay par clinic pahuchein. 🙏\n\n🌐 _Powered by Shahid Creatives_`;

        zamZamBot.sendMessage(chatId, clientReceipt, { parse_mode: 'Markdown', disable_web_page_preview: true });

        // 2. ADMIN KO ALERT BHEJEIN
        const adminAlertMsg = `🚨 *NEW CLINIC APPOINTMENT!* 🚨\n\n`
                            + `👤 *Client Telegram:* ${userName} (${userUsername})\n`
                            + `💬 *Telegram Chat ID:* ${chatId}\n`
                            + `📅 *Date:* ${session.date}\n`
                            + `⏰ *Time Slot:* ${session.time}\n`
                            + `👨‍⚕️ *Doctor:* Dr. ${session.doctor}\n`
                            + `📝 *Patient Details:* ${text}\n`
                            + `🏥 *Condition:* ${session.problem}\n\n`
                            + `*Action Required:*`;

        const adminOptions = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Confirm Booking", callback_data: `admin_zz_confirm_${chatId}` }],
                    [{ text: "🔄 Reschedule / Update Time", callback_data: `admin_zz_resched_${chatId}` }]
                ]
            }
        };

        zamZamBot.sendMessage(ZAMZAM_ADMIN_CHAT_ID, adminAlertMsg, adminOptions)
            .catch((err) => console.error('Failed to send Zam Zam admin alert:', err));

        // State reset karein
        session.step = 'COMPLETED';
    }
});

// ==========================================
// ⏰ BACKGROUND AUTOMATED REMINDERS ENGINE 
// ==========================================
setInterval(() => {
    const now = Date.now();
    activeAppointments.forEach(appt => {
        const diffMs = appt.timestamp - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        // Don't process if already passed or negative
        if (diffHours < 0) return; 
        
        let shouldRemind = false;
        let timeLabel = "";

        // Trigger correctly within the exact bracket bounds
        if (diffHours <= 10 && diffHours > 2 && !appt.reminded['10']) {
            shouldRemind = true; timeLabel = "10 hours"; appt.reminded['10'] = true;
        } else if (diffHours <= 2 && diffHours > 1 && !appt.reminded['2']) {
            shouldRemind = true; timeLabel = "2 hours"; appt.reminded['2'] = true;
        } else if (diffHours <= 1 && diffHours > 0 && !appt.reminded['1']) {
            shouldRemind = true; timeLabel = "1 hour"; appt.reminded['1'] = true;
        }

        if (shouldRemind) {
            const isEn = appt.lang === 'EN';
            const reminderMsg = isEn 
                ? `⏰ *Reminder:* Hello ${appt.clientName}, your appointment is scheduled in exactly *${timeLabel}*! We look forward to seeing you. ✨`
                : `⏰ *Reminder:* Namaste ${appt.clientName}, aapki appointment theek *${timeLabel}* mein shuru hone wali hai! Kripya samay par pahuchein. ✨`;
                
            if (appt.bot === 'salon') {
                salonBot.sendMessage(appt.chatId, reminderMsg, { parse_mode: "Markdown" });
            } else if (appt.bot === 'clinic') {
                zamZamBot.sendMessage(appt.chatId, reminderMsg, { parse_mode: "Markdown" });
            }
        }
    });
}, 60000); // Check every 1 minute


// ==========================================
// 🟢 2. WHATSAPP ENGINE & SERVER LOGIC (ORIGINAL CODE UNTOUCHED)
// ==========================================

// 🟢 LIGHTWEIGHT IN-MEMORY STORAGE (Render Safe Ecosystem)
const userSessions = {};

// 📈 DYNAMIC PRICING LEDGER MAPPING WITH +3.5% GATEWAY FEES FOR USD / +18% GST FOR INR
// Note: Base price passed here is already DISCOUNTED (if applicable) before adding taxes.
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
        // 🚀 AI-Powered Growth Retainers & Telegram Bots
        if (text.includes("starter digital") || text.includes("maintainer")) {
            return "77";
        }
        if (text.includes("web conversion") || text.includes("conversion engine")) {
            return "155";
        }
        if (text.includes("omnichannel") || text.includes("growth partner")) {
            return "311";
        }
        if (text.includes("ecosystem") || text.includes("full-scale")) {
            return "499";
        }
        if (text.includes("elite intelligence") || text.includes("bespoke systems")) {
            return "799";
        }
        if ((text.includes("telegram") && text.includes("starter"))) {
            return "77";
        }
        if ((text.includes("telegram") && text.includes("growth"))) {
            return "155";
        }
        if ((text.includes("telegram") && text.includes("elite"))) {
            return "311";
        }
        
        // 🌐 Web Plans (Strictly excluding AI keywords)
        if (text.includes("starter plan") || text.includes("visiting card") || text.includes("starter / visiting card site")) {
            return "199";
        }
        if (text.includes("basic plan") || text.includes("landing page")) {
            return "299";
        }
        if (text.includes("starter business") || text.includes("business website")) {
            return "499";
        }
        if ((text.includes("e-commerce hub") || text.includes("ecommerce") || text.includes("e-commerce")) && !text.includes("sales automation") && !text.includes("retainer")) {
            return "899";
        }
        if (text.includes("custom enterprise") || text.includes("software")) {
            return "2499";
        }
        
        return "110";
    } else {
        // 🚀 AI-Powered Growth Retainers & Telegram Bots
        if (text.includes("starter digital") || text.includes("maintainer")) {
            return "4999";
        }
        if (text.includes("web conversion") || text.includes("conversion engine")) {
            return "9499";
        }
        if (text.includes("omnichannel") || text.includes("growth partner")) {
            return "18999";
        }
        if (text.includes("ecosystem") || text.includes("full-scale")) {
            return "29999";
        }
        if (text.includes("elite intelligence") || text.includes("bespoke systems")) {
            return "49999";
        }
        if ((text.includes("telegram") && text.includes("starter"))) {
            return "3999";
        }
        if ((text.includes("telegram") && text.includes("growth"))) {
            return "7599";
        }
        if ((text.includes("telegram") && text.includes("elite"))) {
            return "15199";
        }
        
        // 🌐 Web Plans (Strictly excluding AI keywords)
        if (text.includes("landing page") || text.includes("funnel")) {
            return "12300";
        }
        if (text.includes("business") || text.includes("corporate")) {
            return "25500";
        }
        if ((text.includes("e-commerce") || text.includes("store")) && !text.includes("sales automation") && !text.includes("retainer")) {
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
            sendUnifiedMessage(from, nudgeMessage, session.platform || 'whatsapp');
            session.nudgeSent = true; 
        }
    }
}, 60000);

// 🤖 SERVER HEALTH CHECK & META WEBHOOK VERIFICATION (Unified for Root '/')
app.get('/', (req, res) => {
    const VERIFY_TOKEN = "mysecrettoken";
    
    // Check if this is a Meta verification request
    if (req.query['hub.mode'] && req.query['hub.verify_token']) {
        if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
            return res.status(200).send(req.query['hub.challenge']);
        } else {
            return res.sendStatus(403);
        }
    }
    
    // Otherwise, return normal health check
    res.status(200).send("Shahid Creatives Bot Server is Live on Render with Secured Credentials! 🚀 (Telegram & WhatsApp Both Active)");
});

// 🟢 ROUTE HANDLER: Client Credentials Logs Delivery & Admin Alert Sync
app.post('/send-client-credentials', async (req, res) => {
    try {
        const payload = req.body;
        // Check for Telegram Chat ID in payload for direct API requests
        const tgChatId = payload.telegram_chat_id || payload.chat_id || "N/A";
        
        // Admin Alert for API Inbound Event (Added Telegram Chat ID)
        const adminAlertText = `🌟 *NEW API PORTAL LEAD!* 🌟\n\n👤 *Name:* ${payload.name || payload.client_name || "Unknown"}\n📱 *Phone:* ${payload.phone || payload.whatsapp_number || "0000"}\n💬 *Telegram Chat ID:* ${tgChatId}\n✉️ *Email:* ${payload.email || "Not Provided"}\n📝 *Plan Scope:* ${payload.plan || payload.project_scope || "N/A"}\n💰 *Calculated Price:* ${payload.price || payload.calculated_price || 0}`;
        sendAdminAlert(adminAlertText); // Omnichannel Admin Alert

        await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
            client_name: payload.name || payload.client_name || "API Inbound Portal Lead",
            whatsapp_number: payload.phone || payload.whatsapp_number || "0000000000",
            telegram_chat_id: tgChatId,
            project_scope: payload.plan || payload.project_scope || "Credentials Sync Event",
            calculated_price: payload.price || payload.calculated_price || 0,
            email: payload.email || "Not Provided",
            discussion_notes: adminAlertText // ✅ SYNCED WITH NEW PARSER LOGIC
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

// Meta Webhook Verification (Backup for '/webhook' path)
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "mysecrettoken";
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
});

// Main Webhook Logic for Processing WhatsApp Messages
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
                    console.log(`Received message from ${from}: ${rawText}`);
                    
                    // Route directly to Unified Engine (Removed the hardcoded double-reply block)
                    await processUnifiedMessage(from, rawText, 'whatsapp');
                }            
            }
        } catch (error) { 
            console.error("Webhook processing logic error.", error.message); 
        }
    }
}); 

// ==========================================
// 🧠 UNIFIED BOT ENGINE (PROCESSES BOTH TG & WA)
// ==========================================
async function processUnifiedMessage(from, rawText, platform) {
    const userText = rawText.trim().toLowerCase();
    
    // International Check (Only applicable for WhatsApp numbers, Default False for Telegram)
    const isInternationalNumber = platform === 'whatsapp' ? !from.startsWith("91") : false;
    const isGlobalWebsiteTemplate = rawText.includes("Global USD") || rawText.includes("Worldwide") || rawText.includes("$") || rawText.includes("lock in my custom website estimate");

    const resetTriggers = ['hi', 'hello', 'menu', 'start', '/start', 'hey'];
    if (resetTriggers.includes(userText)) { 
        userSessions[from] = null; 
    }

    // 🚨 NEW INTERCEPTOR: PAYMENT FAILED SUPPORT (Catching website payment drop-offs)
    if (rawText.includes("payment transaction failed") || rawText.includes("Failed/Incomplete Booking") || rawText.includes("cancelled or was incomplete")) {
        let clientName = "Valued Client"; 
        let projectScope = "Project"; 
        let projectID = `SC-${Math.floor(1000 + Math.random() * 9000)}`;
        let clientEmail = "Not Provided";
        
        try {
            const nameMatch = rawText.match(/Client Profile:\s*([^(\n]+)/i);
            const scopeMatch = rawText.match(/Project Category:\s*([^(\n]+)/i);
            const idMatch = rawText.match(/Project ID:\s*([^(\n]+)/i);
            const emailMatch = rawText.match(/Email:\s*([^\n\r]+)/i);
            
            if (nameMatch) clientName = nameMatch[1].replace(/[*_]/g, '').trim();
            if (scopeMatch) projectScope = scopeMatch[1].replace(/[*_\[\]]/g, '').trim();
            if (emailMatch) clientEmail = emailMatch[1].trim();
            
            if (idMatch) {
                let extractedId = idMatch[1].trim();
                projectID = extractedId.replace(/^[A-Za-z]+-/, 'SC-');
                if(!projectID.startsWith('SC-')) {
                    projectID = `SC-${projectID.replace(/\D/g, '') || Math.floor(1000 + Math.random() * 9000)}`;
                }
            }
        } catch (e) { }

        // ✅ EXPLICIT LANGUAGE/CURRENCY DETECTION FIX
        const isExplicitUSD = rawText.includes('USD') || rawText.includes('$');
        const isExplicitINR = rawText.includes('INR') || rawText.includes('₹');
        const isUSDTrack = isExplicitUSD ? true : (isExplicitINR ? false : isInternationalNumber);
        const isINRLead = !isUSDTrack;

        const tokenAmount = isINRLead ? 999 : 49;
        const tokenCurrency = isINRLead ? 'INR' : 'USD';
        const matchedBasePriceStr = getBasePriceByPlan(projectScope, isUSDTrack);
        const matchedBasePrice = parseFloat(matchedBasePriceStr) || (isINRLead ? 8713 : 110);
        const savingAmount = Math.round(matchedBasePrice * 0.20);
        const discountedBasePrice = matchedBasePrice - savingAmount;
        const finalPayable = calculateTotalPayable(discountedBasePrice, isUSDTrack);
        
        const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${projectID}&amount=${tokenAmount}&currency=${tokenCurrency}&totalPrice=${finalPayable}&name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail)}&phone=${from}&plan=${encodeURIComponent(projectScope)}&coupon=LAUNCH20`;

        userSessions[from] = { 
            step: 'payment_failed_resolution', // Ask if debit or failed
            lang: isUSDTrack ? 'EN' : 'HINGLISH',
            platform: platform,
            clientName: clientName, 
            clientEmail: clientEmail,
            projectScope: projectScope, 
            savedPlan: projectScope, 
            projectID: projectID,
            payLink: selfPayLink,
            lastInteractionTime: Date.now(), 
            nudgeSent: true 
        };

        // Admin Alert for Emergency Assistance (With Full Base Price Details & Telegram Chat ID)
        const currencyAdmin = isUSDTrack ? '$' : '₹';
        const alertMsg = `🚨 *URGENT: PAYMENT DROP-OFF REPORTED!* 🚨\n\n📱 *Client:* ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${clientName}\n📝 *Plan Scope:* ${projectScope}\n🆔 *Client ID:* ${projectID}\n💵 *Base Price:* ${currencyAdmin}${matchedBasePrice}\n🔥 *Discount Applied:* ${currencyAdmin}${savingAmount} (LAUNCH20)\n💰 *Calculated Price:* ${currencyAdmin}${finalPayable}\n\n⚠️ *Action:* Client bot interaction active to check debit/cancel status.`;
        sendAdminAlert(alertMsg);

        // Client Question Phase
        let replyMsg = isINRLead
            ? `Oh no! 😟 Maafi chahte hain *${clientName}*, lagta hai aapka *${projectScope}* ka transaction technical issue ki wajah se ruk gaya hai.\n\nKripya batayein ki aapke account ka status kya hai? Niche diye gaye options mein se ek (1 ya 2) chunein:\n\n1️⃣ **Payment account se kat gaya hai (Amount Debited)**\n2️⃣ **Payment fail ya cancel ho gaya tha (Failed/Cancelled)**`
            : `Oh no! 😟 I'm sorry to hear that your transaction for the *${projectScope}* encountered an issue, *${clientName}*.\n\nCould you please confirm your account status? Reply with 1 or 2:\n\n1️⃣ **The amount was debited from my account**\n2️⃣ **The payment failed or was cancelled**`;
            
        return sendUnifiedMessage(from, replyMsg, platform);
    }

    if (!userSessions[from]) {
        userSessions[from] = { 
            step: 'region_check', 
            lang: (isInternationalNumber || isGlobalWebsiteTemplate) ? 'EN' : 'HINGLISH', 
            platform: platform, // Storing platform logic
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
    const session = userSessions[from]; // local reference

    // 🎯 STATE: PAYMENT FAILED RESOLUTION - Check Debit Status
    if (currentStep === 'payment_failed_resolution') {
        const isINRLead = userLang !== 'EN';
        
        if (userText === '1' || userText.includes("debit") || userText.includes("kat gaya")) {
            userSessions[from].step = 'completed';
            let waitMsg = isINRLead
                ? `Dhanyawad *${session.clientName}*. 🙏 Agar amount debited ho gaya hai, to kripya 30 minute tak intezaar karein. System payment ko automatically verify kar raha hai. Agar koi dikkat hoti hai, to Shahid Creatives ki Team aapse jald hi manual verification ke liye sampark karegi. Aapka slot 100% safe hai! 🛡️\n\n🌐 _Powered by Shahid Creatives_`
                : `Thank you, *${session.clientName}*. 🙏 If the amount has been debited, please wait for up to 30 minutes. Our system is auto-verifying the payment. If there's any issue, Shahid Creatives' Team will contact you shortly for manual verification. Your slot is perfectly safe! 🛡️\n\n🌐 _Powered by Shahid Creatives_`;
            return sendUnifiedMessage(from, waitMsg, platform);
        } 
        else if (userText === '2' || userText.includes("fail") || userText.includes("cancel")) {
            userSessions[from].step = 'payment_failed_retry_options';
            let retryMsg = isINRLead
                ? `Koi baat nahi *${session.clientName}*! Aapka *${session.projectScope}* ka slot abhi bhi reserved hai. Aap apna token lock karne ke liye inme se koi ek option chun sakte hain:\n\n1️⃣ **Dubara Pay Karein (Retry Token Payment)**\n2️⃣ **Consultation Book Karein (Talk to Team)**\n\n👉 Kripya 1 ya 2 likh kar reply karein:`
                : `No worries, *${session.clientName}*! Your slot for *${session.projectScope}* is still reserved. You can secure your token by choosing one of the following:\n\n1️⃣ **Retry Token Payment**\n2️⃣ **Book a Consultation Call**\n\n👉 Please reply with 1 or 2:`;
            return sendUnifiedMessage(from, retryMsg, platform);
        } else {
            return sendUnifiedMessage(from, isINRLead ? "❌ Kripya 1 ya 2 chunein." : "❌ Please reply with 1 or 2.", platform);
        }
    }

    // 🎯 STATE: PAYMENT FAILED RETRY OPTIONS - Process Link or Booking
    if (currentStep === 'payment_failed_retry_options') {
        const isINRLead = userLang !== 'EN';
        const payLink = session.payLink || "https://shahidcreatives.com/";

        if (userText === '1' || userText.includes("pay") || userText.includes("retry") || userText.includes("dubara")) {
            userSessions[from].step = 'completed';
            let payReply = isINRLead
                ? `Great! Apna slot secure karne ke liye kripya niche diye gaye link ka upyog karein:\n\n🔗 *Secure Checkout Portal:* ${payLink}\n\n_Note: Payment successful hote hi Shahid Creatives ki Team aapko turant contact karegi!_\n\n🌐 _Powered by Shahid Creatives_`
                : `Great! Please use the secure link below to lock your slot:\n\n🔗 *Secure Checkout Portal:* ${payLink}\n\n_Note: Shahid Creatives' Team will reach out immediately upon confirmation!_\n\n🌐 _Powered by Shahid Creatives_`;
            return sendUnifiedMessage(from, payReply, platform);
        } 
        else if (userText === '2' || userText.includes("consult") || userText.includes("book") || userText.includes("talk")) {
            userSessions[from].step = 'awaiting_consultation_slot';
            const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
            
            const optionA = (currentHourIST >= 17) ? "🅰️ *Kal Shaam 5:00 Baje*" : "🅰️ *Aaj Shaam 5:00 Baje*";
            const optionB = (currentHourIST >= 17) ? "🅱️ *Parso Dopahar 12:00 Baje*" : "🅱️ *Kal Dopahar 12:00 Baje*";
            const optionA_EN = (currentHourIST >= 17) ? "🅰️ *Tomorrow at 5:00 PM*" : "🅰️ *Today at 5:00 PM*";
            const optionB_EN = (currentHourIST >= 17) ? "🅱️ *Day After Tomorrow at 12:00 PM*" : "🅱️ *Tomorrow at 12:00 PM*";

            return sendUnifiedMessage(from, (userLang === 'EN') 
                ? `👤 *Direct Consultation Setup:*\n\n${optionA_EN}\n${optionB_EN}\n🅲️ *Custom Time (Type preferred time below)*\n\n👉 Reply with A, B, or C!` 
                : `👤 *Direct Consultation Setup:*\n\n${optionA}\n${optionB}\n🅲️ *Custom Time (Apna secure timing niche type karein)*\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye!`, platform);
        } else {
            return sendUnifiedMessage(from, isINRLead ? "❌ Kripya 1 ya 2 chunein." : "❌ Please reply with 1 or 2.", platform);
        }
    }

    const courtesyTriggers = ['thanks', 'thank you', 'ok', 'okay', 'ji', 'shukriya', 'thx'];
    if (courtesyTriggers.includes(userText)) {
        userSessions[from] = null; 
        let courtesyReply = (userLang === 'EN')
            ? "You're most welcome! 👍 Glad to help. Type 'Menu' anytime if you want to explore again.\n\n🌐 _Powered by Shahid Creatives_"
            : "Aapka swagat hai! 👍 Milte hain aapse bohot jald discovery call par. Dobara shuru karne ke liye kisi bhi waqt 'Menu' ya 'Hi' bheinje.\n\n🌐 _Powered by Shahid Creatives_";
        return sendUnifiedMessage(from, courtesyReply, platform);
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
        let savedAmountWeb = 0;
        
        try {
            const nameMatch = rawText.match(/(?:Client Name|Name|👤)[^:]*:\s*([^\n\r]+)/i);
            const scopeMatch = rawText.match(/(?:Project\/Category|Plan Chosen|Category Model|Specifications|Plan)[^:]*:\s*([^\n\r(₹$]+)/i);
            
            const savedMatch = rawText.match(/\(Saved\s*[₹\$]?\s*([0-9.,]+)\)/i);
            if (savedMatch) {
                savedAmountWeb = Math.round(parseFloat(savedMatch[1].replace(/,/g, '')));
            }
            
            if (nameMatch) {
                clientName = nameMatch[1].replace(/[*_]/g, '').split(',')[0].trim();
            }
            if (scopeMatch) {
                projectScope = scopeMatch[1].replace(/[*_\[\]]/g, '').trim();
            }
            
            const allPrices = [...rawText.matchAll(/[₹$]\s*([0-9.,]+)/g)];
            if (allPrices.length > 0) {
                parsedBasePrice = Math.round(parseFloat(allPrices[allPrices.length - 1][1].replace(/,/g, '')));
            }
            
            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
            const emailMatch = rawText.match(globalEmailRegex);
            if (emailMatch) {
                clientEmail = emailMatch[1].trim();
            }
        } catch (parseError) { 
            console.error("Parser failure exception inside landing template."); 
        }
        
        // ✅ EXPLICIT LANGUAGE/CURRENCY DETECTION FOR FORM FIX
        const isExplicitUSDForm = rawText.includes('USD') || rawText.includes('$');
        const isExplicitINRForm = rawText.includes('INR') || rawText.includes('inr') || rawText.includes('₹');
        const formIsUSDTrack = isExplicitUSDForm ? true : (isExplicitINRForm ? false : isInternationalNumber);

        if (userText.includes("paid the full amount") || userText.includes("advance amount paid") || userText.includes("paid the full") || userText.includes("i just paid")) {
            
            userSessions[from] = { 
                step: 'post_registration', 
                lang: formIsUSDTrack ? 'EN' : 'HINGLISH', 
                platform: platform,
                clientName: clientName, 
                clientEmail: clientEmail, 
                projectScope: projectScope, 
                lastSubmitedTime: Date.now(), 
                lastInteractionTime: Date.now(), 
                nudgeSent: true 
            };
            
            const paidAdminAlert = `✅ *PAID CLIENT REGISTERED!* ✅\n\n📱 *Client Contact:* ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${clientName}\n✉️ *Email:* ${clientEmail}\n📝 *Plan Scope:* ${projectScope}\n💰 *Calculated Price:* ${formIsUSDTrack ? '$' : '₹'}${parsedBasePrice}\n💳 *Status:* Fully Paid via Portal Gateway!`;
            sendAdminAlert(paidAdminAlert);

            try {
                await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                    client_name: clientName, 
                    whatsapp_number: from,
                    telegram_chat_id: platform === 'telegram' ? from : undefined, 
                    project_scope: `${projectScope} (Status: Fully Paid Portal Form)`, 
                    calculated_price: parsedBasePrice, 
                    email: clientEmail,
                    discussion_notes: paidAdminAlert // ✅ SYNCED WITH NEW PARSER LOGIC
                });
            } catch (err) { 
                console.error("Paid lead API sync error:", err.message); 
            }
            
            let paidSuccessReply = (userSessions[from].lang === 'EN')
                ? `Thank you *${clientName}*! 🙏 Your paid booking has been successfully verified on our dashboard.\n\n⚡ *Status:* **Project Consultation Stage Activated!**\n\n🌐 _Powered by Shahid Creatives_`
                : `Mubarak ho *${clientName}*! 🙏 Aapki payment received data hamare dashboard par successfully sync ho gayi hai.\n\n⚡ *Status:* **Project Consultation Stage Active!**\n\n🌐 _Powered by Shahid Creatives_`;
            return sendUnifiedMessage(from, paidSuccessReply, platform);
        }

        userSessions[from] = { 
            step: 'awaiting_website_action', 
            lang: formIsUSDTrack ? 'EN' : 'HINGLISH', 
            platform: platform,
            clientName: clientName, 
            clientEmail: clientEmail, 
            projectScope: projectScope, 
            lastSubmitedTime: Date.now(), 
            lastInteractionTime: Date.now(), 
            nudgeSent: false 
        };
        
        const calculatedPrice = parsedBasePrice; 
        const isINRLead = !formIsUSDTrack;
        const currencyAdmin = isINRLead ? '₹' : '$';

        // Admin Notification Sync with Complete Base Details Fix (Added Telegram Chat ID)
        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${clientName}\n📝 *Plan Scope:* ${projectScope}\n💵 *Base Price:* ${currencyAdmin}${calculatedPrice + savedAmountWeb}\n🔥 *Discount Applied:* ${currencyAdmin}${savedAmountWeb} (LAUNCH20)\n💰 *Calculated Price:* ${currencyAdmin}${calculatedPrice}`;
        sendAdminAlert(adminNotification);

        try {
            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                client_name: clientName, 
                whatsapp_number: from,
                telegram_chat_id: platform === 'telegram' ? from : undefined, 
                project_scope: projectScope, 
                calculated_price: calculatedPrice, 
                email: clientEmail,
                discussion_notes: adminNotification // ✅ SYNCED WITH NEW PARSER LOGIC
            });
        } catch (err) { 
            console.error("Meta Dashboard sync err."); 
        }

        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
        const tokenAmount = isINRLead ? 999 : 49;
        const tokenCurrency = isINRLead ? 'INR' : 'USD';
        const guaranteeText = isINRLead ? 'INR Slot Guarantee' : 'USD Slot Guarantee';

        const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmount}&currency=${tokenCurrency}&totalPrice=${calculatedPrice}&name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail)}&phone=${from}&plan=${encodeURIComponent(projectScope)}&coupon=LAUNCH20`;

        let clientReply = isINRLead
            ? `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved to our dashboard.\n\n🔥 *URGENT:* Aapka **Flat 20% OFF (LAUNCH20)** coupon apply ho chuka hai! Aapne is deal par sidha **₹${savedAmountWeb > 0 ? savedAmountWeb : '20%'}** save kar liya hai. Ye limited-time offer expire hone se pehle apna slot lock karein. (*T&C Apply*)\n\n🔗 *Pay Securely Here (${guaranteeText}):* ${selfPayLink}\n\n_Note: Payment verify hote hi Shahid Creatives ki Team seedha aapse sampark karegi!_`
            : `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved to our dashboard.\n\n🔥 *URGENT:* Your **Flat 20% OFF (LAUNCH20)** coupon is currently applied! You just saved **$${savedAmountWeb > 0 ? savedAmountWeb : '20%'}** on this deal. Lock your slot before this limited-time offer expires. (*T&C Apply*)\n\n🔗 *Pay Securely Here (${guaranteeText}):* ${selfPayLink}\n\n_Note: Shahid Creatives' Team will reach out immediately upon confirmation!_`;
        
        return sendUnifiedMessage(from, clientReply, platform);
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
            return sendUnifiedMessage(from, nudgeResponse, platform);
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
            let replyText = (userLang === 'EN')
                ? "Hello! Welcome to *Shahid Creatives*. 🚀\nSelect a professional stack tier via option number:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI-Powered Growth Retainers**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid Creatives' Team (Direct Consultation)**"
                : "Hello! Welcome to *Shahid Creatives*. 🚀\nKoshish ko aage badhane ke liye ek option number reply kijiye:\n\n1️⃣ *Web Development Tiers*\n2️⃣ *AI-Powered Growth Retainers*\n3️⃣ *🔥 Exclusive Launch Deal*\n4️⃣ *💳 Direct Booking & Token System*\n5️⃣ *👤 Talk to Shahid Creatives ki Team* (Direct Consultation)";
            return sendUnifiedMessage(from, replyText, platform);
        } else {
            return sendUnifiedMessage(from, "Welcome to *Shahid Creatives*! 🚀 Please select your location layout to proceed:\n\n1️⃣ **India (Tax/Billing: ₹ INR)**\n2️⃣ **Outside India (Global Billing: $ USD)**", platform);
        }
    }

    // 🎯 DEDICATED CAPTURE ROUTE FOR CUSTOM SCHEDULING TEXT
    if (currentStep === 'awaiting_custom_time_input') {
        let cleanInputTime = userText.replace(/[cCc🅲🅲️\-\*•\(\)]/g, '').trim();
        userSessions[from].requestedSlot = rawText;
        
        if (!userSessions[from].savedPlan) userSessions[from].savedPlan = userSessions[from].projectScope;

        if (userSessions[from].skipIdentityCapture || (userSessions[from].clientName && userSessions[from].clientName !== "Valued Client" && userSessions[from].clientEmail && userSessions[from].clientEmail !== "Not Provided" && userSessions[from].clientEmail !== "")) {
            userSessions[from].step = 'post_registration';
            return finalizeConsultationLead(from, userSessions[from].savedPlan || "Consultation Booking", null, platform);
        } else {
            userSessions[from].step = 'collect_consultation_identity';
            userSessions[from].projectScope = `Custom Slot Input ("${rawText}")`;
            
            // Dynamic Prompt for Telegram Phone Capture
            let promptText = (userLang === 'EN')
                ? (platform === 'telegram' 
                    ? `Got it! Custom slot parameters recorded: *"${rawText}"*\n\n✍ *Please complete your profile:* Kindly reply with your *Full Name, Email Address, and Mobile Number* (separated by commas, e.g. John Doe, john@example.com, +919876543210).` 
                    : `Got it! Custom slot parameters recorded: *"${rawText}"*\n\n✍ *Please complete your profile:* Kindly reply with your *Full Name* and *Email Address* (separated by comma, e.g. John Doe, john@example.com).`)
                : (platform === 'telegram'
                    ? `Noted! Aapka preferred date/time save ho gaya hai: *"${rawText}"*\n\n✍ *Apna profile register karein:* Kripya reply mein apna *Full Name, Email ID, aur Mobile Number* comma (,) lagakar bheinjein (jaise: Sarfaraj Khan, sarfaraj@example.com, 9876543210).`
                    : `Noted! Aapka preferred date/time save ho gaya hai: *"${rawText}"*\n\n✍ *Apna profile register karein:* Kripya reply mein apna *Full Name* aur *Email ID* comma (,) lagakar bheinjein (jaise: Sarfaraj Khan, sarfaraj@example.com).`);
                    
            return sendUnifiedMessage(from, promptText, platform);
        }
    }

    // 🎯 STATE 1: COLLECT IDENTITY (STRICT MANDATORY NAME & EMAIL & PHONE CHECK)
    if (currentStep === 'collect_consultation_identity') {
        let cleanName = ""; 
        let cleanEmail = "";
        let cleanPhone = (platform === 'whatsapp') ? from : ""; // Default WA number
        
        if (rawText.includes(",")) {
            const parts = rawText.split(","); 
            cleanName = parts[0] ? parts[0].trim() : ""; 
            cleanEmail = parts[1] ? parts[1].trim() : "";
            if (parts.length >= 3 && platform === 'telegram') {
                cleanPhone = parts[2].trim().replace(/[^0-9+]/g, '');
            }
        } else {
            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
            const emailMatch = rawText.match(globalEmailRegex);
            if (emailMatch) { 
                cleanEmail = emailMatch[1].trim(); 
                cleanName = rawText.replace(emailMatch[0], "").replace(/[,]/g, "").trim(); 
            }
        }

        let isPhoneValid = (platform === 'whatsapp') || (cleanPhone && cleanPhone.length >= 7);

        if (!cleanName || cleanName.length < 2 || !cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".") || !isPhoneValid) {
            let errorMsg = (userLang === 'EN')
                ? (platform === 'telegram' 
                    ? "⚠️ *Format Error!* Full Name, Email ID, and Mobile Number are strictly mandatory.\n\n👉 Please reply again in this exact structure: *Your Name, your-email@example.com, +919876543210*"
                    : "⚠️ *Format Error!* Both **Full Name** and a valid **Email ID** are strictly mandatory.\n\n👉 Please reply again in this exact structure: *Your Name, your-email@example.com*")
                : (platform === 'telegram'
                    ? "⚠️ *Registration Error!* Profile lock karne ke liye Full Name, Email ID, aur Mobile Number zaroori hain.\n\n👉 Kripya dubara is tarah likh kar bhejin: *Aapka Name, aapkaemail@gmail.com, 9876543210*"
                    : "⚠️ *Registration Error!* Profile lock karne ke liye **Full Name** aur ek valid **Email ID** dono zaroori hain.\n\n👉 Kripya dubara is tarah likh kar bhejin: *Aapka Name, aapkaemail@gmail.com*");
                    
            return sendUnifiedMessage(from, errorMsg, platform);
        }
        
        userSessions[from].step = 'collect_custom_query_and_time'; 
        userSessions[from].clientName = cleanName; 
        userSessions[from].clientEmail = cleanEmail;
        userSessions[from].clientPhone = cleanPhone; // Saved!

        let descriptivePrompt = (userLang === 'EN')
            ? `Thank you *${cleanName}*! 🙏\n\nTo lock a high-converting strategy blueprint, please share your goals in the next reply:\n\n🌐 **1. Website Development:**\nWhich plan fits your vision? (Starter Plan, Basic Plan, Starter Business Site, or E-Commerce Hub?)\n\n🤖 **2. AI-Powered Growth Retainers:**\nWhat precise processes do you want to automate?`
            : `Thank you *${cleanName}*! 🙏\n\nStrategy call ko 100% efficient banane ke liye, kripya agle message mein niche di gayi details batayein:\n\n🌐 **Type 1:** Agar aapko Website chahiye toh specific type likhein (e.g., Landing Page, Corporate Showcase, ya Online Store).\n\n🤖 **Type 2:** Agar AI Architecture/Bot chahiye toh details likhein (e.g., AI SEO, WhatsApp Lead Bot, Sales Engine).`;
        return sendUnifiedMessage(from, descriptivePrompt, platform);
    }

    // 🎯 STATE 2: INTERCEPTOR FOR SELECTIONS (1 OR 2 VALIDATION ENGINE)
    if (currentStep === 'collect_custom_query_and_time') {
        const isUSDTrack = (userLang === 'EN');

        if (userText === '1' || userText === '2' || userText === 'type 1' || userText === 'type 2') {
            userSessions[from].step = 'awaiting_specific_service_selection';
            userSessions[from].lastSelectedType = userText.includes('1') ? 'web' : 'ai';
            
            let interceptorReply = "";
            let options = null;

            // WhatsApp/Text Numbered Structure
            if (userText.includes('1')) {
                interceptorReply = isUSDTrack 
                    ? "⚠️ Please be specific! Which Web scope do you need? \n\n👉 Reply with an option number (1-4):\n1️⃣ *Starter Plan* ($199)\n2️⃣ *Basic Plan* ($299)\n3️⃣ *Starter Business Site* ($499)\n4️⃣ *E-Commerce Hub* ($899)"
                    : "⚠️ Kripya clear batayein! Aapko hamare active modules mein se kis tarah ki website chahiye? \n\n👉 Niche diye gaye options mein se ek number (1-4) reply karein:\n1️⃣ *Landing Page/Funnel* (₹12,300)\n2️⃣ *Business/Corporate Website* (₹25,500)\n3️⃣ *E-commerce Website (Online Store)* (₹47,500)\n4️⃣ *Custom Web Application* (₹1,45,000+)";
            } else {
                interceptorReply = isUSDTrack 
                    ? "⚠️ Please be specific! What AI architecture do you want? \n\n👉 Reply with an option number (1-8):\n1️⃣ *Starter Digital Maintainer* ($77)\n2️⃣ *Web Conversion Engine* ($155)\n3️⃣ *Omnichannel Growth Partner* ($311)\n4️⃣ *Full-Scale Ecosystem Operations* ($499)\n5️⃣ *Elite Intelligence* ($799)\n6️⃣ *Telegram Universal Automation - Starter* ($77)\n7️⃣ *Telegram Universal Automation - Growth* ($155)\n8️⃣ *Telegram Universal Automation - Elite* ($311)"
                    : "⚠️ Kripya clear batayein! Aapko kis tarah ka automation stack design karwana hai? \n\n👉 Niche diye gaye options mein se ek number (1-8) reply karein:\n1️⃣ *Starter Digital Maintainer* (₹4,999/Mo)\n2️⃣ *Web Conversion Engine* (₹9,499/Mo)\n3️⃣ *Omnichannel Growth Partner* (₹18,999/Mo)\n4️⃣ *Full-Scale Ecosystem Operations* (₹29,999/Mo)\n5️⃣ *Elite Intelligence & Bespoke Systems* (₹49,999/Mo)\n6️⃣ *Telegram Universal Automation - Starter* (₹3,999/Mo)\n7️⃣ *Telegram Universal Automation - Growth* (₹7,599/Mo)\n8️⃣ *Telegram Universal Automation - Elite* (₹15,199/Mo)";
            }

            // Interactive Inline Keyboards for Telegram
            if (platform === 'telegram') {
                if (userText.includes('1')) {
                    options = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "1️⃣ Starter Plan", callback_data: "sel_web_1" }, { text: "2️⃣ Basic Plan", callback_data: "sel_web_2" }],
                                [{ text: "3️⃣ Business Site", callback_data: "sel_web_3" }, { text: "4️⃣ E-Commerce Hub", callback_data: "sel_web_4" }]
                            ]
                        }
                    };
                } else {
                     options = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "1️⃣ Starter Digital", callback_data: "sel_ai_1" }, { text: "2️⃣ Web Conv.", callback_data: "sel_ai_2" }],
                                [{ text: "3️⃣ Omnichannel", callback_data: "sel_ai_3" }, { text: "4️⃣ Ecosystem", callback_data: "sel_ai_4" }],
                                [{ text: "5️⃣ Elite Intel", callback_data: "sel_ai_5" }, { text: "6️⃣ TG Starter", callback_data: "sel_ai_6" }],
                                [{ text: "7️⃣ TG Growth", callback_data: "sel_ai_7" }, { text: "8️⃣ TG Elite", callback_data: "sel_ai_8" }]
                            ]
                        }
                    };
                }
            }
            
            return sendUnifiedMessage(from, interceptorReply, platform, options);
        }

        userSessions[from].step = 'post_registration';
        return finalizeConsultationLead(from, rawText, null, platform);
    }

    // 🎯 STATE 2.1: FINAL DISPATCH AFTER SUB-MENU SELECTION (Mapped from Text or Button Input)
    if (currentStep === 'awaiting_specific_service_selection') {
        let selectedScope = rawText;
        const isUSDTrack = (userLang === 'EN');
        const cat = userSessions[from].lastSelectedType || 'ai';

        if (cat === 'web') {
            if (isUSDTrack) {
                if (userText === '1') selectedScope = "Starter Plan";
                else if (userText === '2') selectedScope = "Basic Plan";
                else if (userText === '3') selectedScope = "Starter Business Site";
                else if (userText === '4') selectedScope = "E-Commerce Hub";
            } else {
                if (userText === '1') selectedScope = "Landing Page/Funnel";
                else if (userText === '2') selectedScope = "Business/Corporate Website";
                else if (userText === '3') selectedScope = "E-commerce Website";
                else if (userText === '4') selectedScope = "Custom Web Application";
            }
        } else {
            if (userText === '1') selectedScope = "Starter Digital Maintainer";
            else if (userText === '2') selectedScope = "Web Conversion Engine";
            else if (userText === '3') selectedScope = "Omnichannel Growth Partner";
            else if (userText === '4') selectedScope = "Full-Scale Ecosystem Operations";
            else if (userText === '5') selectedScope = "Elite Intelligence & Bespoke Systems";
            else if (userText === '6') selectedScope = "Telegram Universal Automation - Starter";
            else if (userText === '7') selectedScope = "Telegram Universal Automation - Growth";
            else if (userText === '8') selectedScope = "Telegram Universal Automation - Elite";
        }

        userSessions[from].step = 'post_registration';
        return finalizeConsultationLead(from, selectedScope, null, platform);
    }

    // 🎯 STATE 3: INBOUND SEQUENCE (Fallback)
    if (currentStep === 'collect_details') {
        userSessions[from].projectScope = rawText; 
        userSessions[from].step = 'ask_name_email';
        
        let prompt = (userLang === 'EN')
            ? (platform === 'telegram' ? "Awesome! 📝 Kindly reply with your **Full Name, Email Address, and Mobile Number** (comma separated)." : "Awesome! 📝 Kindly reply with your **Full Name** and **Email Address**.")
            : (platform === 'telegram' ? "Awesome! 📝 Kripya apna **Full Name, Email ID, aur Mobile Number** bhej lijiye (comma lagakar)." : "Awesome! 📝 Kripya apna **Full Name** aur **Email ID** bhej lijiye.");
        return sendUnifiedMessage(from, prompt, platform);
    }

    // 🎯 STATE 4: INBOUND CHAT REGISTRATION COMPLETED
    if (currentStep === 'ask_name_email') {
        let cleanName = ""; 
        let cleanEmail = "";
        let cleanPhone = (platform === 'whatsapp') ? from : ""; // Default WA number
        
        if (rawText.includes(",")) {
            const parts = rawText.split(","); 
            cleanName = parts[0] ? parts[0].trim() : ""; 
            cleanEmail = parts[1] ? parts[1].trim() : "";
            if (parts.length >= 3 && platform === 'telegram') {
                cleanPhone = parts[2].trim().replace(/[^0-9+]/g, '');
            }
        } else {
            const globalEmailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/i;
            const emailMatch = rawText.match(globalEmailRegex);
            if (emailMatch) { 
                cleanEmail = emailMatch[1].trim(); 
                cleanName = rawText.replace(emailMatch[0], "").replace(/[,]/g, "").trim(); 
            }
        }

        let isPhoneValid = (platform === 'whatsapp') || (cleanPhone && cleanPhone.length >= 7);

        if (!cleanName || cleanName.length < 2 || !cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".") || !isPhoneValid) {
            let errorMsg = (userLang === 'EN') 
                ? (platform === 'telegram' 
                    ? "⚠️ *Format Error!* Full Name, Email ID, and Mobile Number are strictly mandatory to generate the payment token.\n\n👉 Please reply again in this exact structure: *Your Name, your-email@example.com, +919876543210*"
                    : "⚠️ *Format Error!* Both **Full Name** and a valid **Email ID** are strictly mandatory to generate the payment token.\n\n👉 Please reply again in this exact structure: *Your Name, your-email@example.com*")
                : (platform === 'telegram'
                    ? "⚠️ *Registration Error!* Link generate karne ke liye Full Name, Email ID, aur Mobile Number zaroori hain.\n\n👉 Kripya dubara is tarah likh kar bhejin: *Aapka Name, aapkaemail@gmail.com, 9876543210*"
                    : "⚠️ *Registration Error!* Link generate karne ke liye **Full Name** aur ek valid **Email ID** dono zaroori hain.\n\n👉 Kripya dubara is tarah likh kar bhejin: *Aapka Name, aapkaemail@gmail.com*");
                    
            return sendUnifiedMessage(from, errorMsg, platform);
        }

        userSessions[from].step = 'completed'; 
        userSessions[from].clientName = cleanName; 
        userSessions[from].clientEmail = cleanEmail;
        userSessions[from].clientPhone = cleanPhone; // Saved!
        
        const isUSDTrack = (userLang === 'EN');
        const matchedBasePriceStr = getBasePriceByPlan(userSessions[from].projectScope, isUSDTrack);
        const matchedBasePrice = parseFloat(matchedBasePriceStr);

        // 🎯 20% DISCOUNT STRICTLY ON BASE PRICE ONLY
        const savingAmount = Math.round(matchedBasePrice * 0.20); 
        const discountedBasePrice = matchedBasePrice - savingAmount;

        // 🎯 GST + GATEWAY ON THE DISCOUNTED BASE PRICE
        const finalPayable = calculateTotalPayable(discountedBasePrice, isUSDTrack);
        const currencySymbol = isUSDTrack ? '$' : '₹';

        const displayPhone = userSessions[from].clientPhone || (platform === 'whatsapp' ? from : "Not Provided");

        // 🎯 ADMIN ALERT COMPLETE PRICE DETAIL FIX (Added Telegram Chat ID)
        const chatAdminNotification = `🌟 *NEW INBOUND CHAT LEAD!* 🌟\n\n📱 *Client Contact:* ${displayPhone} ${platform === 'telegram' ? '(Telegram)' : '(WhatsApp)'}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${cleanName}\n✉️ *Email:* ${cleanEmail}\n📝 *Plan Scope:* ${userSessions[from].projectScope}\n💵 *Base Price:* ${currencySymbol}${matchedBasePrice}\n🔥 *Discount Applied:* ${currencySymbol}${savingAmount} (LAUNCH20)\n💰 *Calculated Price:* ${currencySymbol}${finalPayable}`;
        sendAdminAlert(chatAdminNotification);

        try {
            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                client_name: cleanName, 
                whatsapp_number: displayPhone, 
                telegram_chat_id: platform === 'telegram' ? from : undefined,
                project_scope: userSessions[from].projectScope, 
                calculated_price: finalPayable, 
                email: cleanEmail,
                discussion_notes: chatAdminNotification // ✅ SYNCED WITH NEW PARSER LOGIC
            });
        } catch (dashboardError) { 
            console.error("Admin Sync exception logic execution handler."); 
        }

        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
        const encodedName = encodeURIComponent(cleanName); 
        const encodedEmail = encodeURIComponent(cleanEmail); 
        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);

        const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${isUSDTrack ? 49 : 999}&currency=${isUSDTrack ? 'USD' : 'INR'}&totalPrice=${finalPayable}&name=${encodedName}&email=${encodedEmail}&phone=${displayPhone}&plan=${encodedPlan}&coupon=LAUNCH20`;

        let replyText = isUSDTrack 
            ? `🎉 *Success!* Your requirement for *${userSessions[from].projectScope}* is formally registered.\n\n🔥 *URGENT:* A special **Flat 20% OFF (LAUNCH20)** coupon has been automatically applied to your base price! You are saving **$${savingAmount}** today. Lock your price now before the offer expires. (*T&C Apply*)\n\n*Next Steps:*\nTo initiate your project development slot, please process the standard booking token ($49 USD) via our secure gateway below:\n\n🔗 *Secure Checkout Portal:* ${selfPayLink}\n\n_Note: Shahid Creatives' Team will reach out immediately upon confirmation!_\n\n🌐 _Powered by Shahid Creatives_`
            : `🎉 *Mubarak ho!* Aapki requirement (*${userSessions[from].projectScope}*) successfully hamare dashboard mein register ho gayi hai.\n\n🔥 *URGENT:* Aapke base price par **Flat 20% OFF (LAUNCH20)** coupon automatically apply kar diya gaya hai! Aaj is deal par aap **₹${savingAmount}** bacha rahe hain. Offer expire hone se pehle apna price lock karein. (*T&C Apply*)\n\n*Next Steps:*\nApna slot pakka karne aur project shuru karne ke liye kripya apna Token Amount (₹999 INR) niche diye gaye secure payment link par clear karein:\n\n🔗 *Secure Checkout Portal:* ${selfPayLink}\n\n_Note: Payment verify hote hi Shahid Creatives ki Team seedha aapse sampark karegi!_\n\n🌐 _Powered by Shahid Creatives_`;
        
        return sendUnifiedMessage(from, replyText, platform);
    }

    // 🎯 STATE 5: INTERCEPTING MENU CHOICES FOR WEBSITE ACTION
    if (currentStep === 'awaiting_website_action') {
        if (userText === '1' || userText.includes("token") || userText.includes("book") || userText.includes("confirm")) {
            userSessions[from].step = 'process_requirement_menu';
            let requirementPrompt = (userLang === 'EN')
                ? "Please select what you want to build today by replying with the option number (**1 to 5**):\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3 Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Custom Enterprise App ($2,499)"
                : "Perfect! Pehle aapki structural requirement lock kar lete hain. 🚀\n\nNiche diye gaye options mein se koi ek number (*1 se 4*) reply kijiye:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)";
            return sendUnifiedMessage(from, requirementPrompt, platform);
        } else if (userText === '2' || userText.includes("discuss") || userText.includes("call") || userText.includes("strategy")) {
            userSessions[from].step = 'post_registration';
            return sendUnifiedMessage(from, (userLang === 'EN') ? "👤 Perfect! Shahid Creatives' Team will connect with you shortly for a strategy sync call.\n\n🌐 _Powered by Shahid Creatives_" : "👤 Perfect! Shahid Creatives ki Team bohot jald aapke sath strategy call par connect karegi. Get ready to launch! 🚀\n\n🌐 _Powered by Shahid Creatives_", platform);
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
            
            let promptText = (userLang === 'EN')
                ? (platform === 'telegram' ? `Awesome! Selected: *${dynamicCategory}*. 📝 Kindly reply with your **Full Name, Email Address, and Mobile Number** (comma separated).` : `Awesome! Selected: *${dynamicCategory}*. 📝 Kindly reply with your **Full Name** and **Email Address**.`)
                : (platform === 'telegram' ? `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📝 Ab kripya apna **Full Name, Email ID, aur Mobile Number** reply mein bhej lijiye.` : `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bhej lijiye.`);
            
            return sendUnifiedMessage(from, promptText, platform);
        } else {
            return sendUnifiedMessage(from, isUSDTrack ? "❌ Invalid choice. Reply from valid options." : "❌ Samajh nahi paye. Kripya list mein se ek number bheinje.", platform);
        }
    }

    // 🎯 STATE 5.2: PROCESS AUTOMATION REQ SELECTION (ALL 8 PLANS TOGETHER)
    if (currentStep === 'process_automation_menu') {
        let isAutomateMatch = false;
        let dynamicCategory = "";

        if (userText === '1' || userText.includes("starter digital") || userText.includes("maintainer")) { dynamicCategory = "Starter Digital Maintainer"; isAutomateMatch = true; }
        else if (userText === '2' || userText.includes("web conversion") || userText.includes("conversion engine")) { dynamicCategory = "Web Conversion Engine"; isAutomateMatch = true; }
        else if (userText === '3' || userText.includes("omnichannel") || userText.includes("growth partner")) { dynamicCategory = "Omnichannel Growth Partner"; isAutomateMatch = true; }
        else if (userText === '4' || userText.includes("ecosystem") || userText.includes("full-scale")) { dynamicCategory = "Full-Scale Ecosystem Operations"; isAutomateMatch = true; }
        else if (userText === '5' || userText.includes("elite intelligence") || userText.includes("bespoke systems")) { dynamicCategory = "Elite Intelligence & Bespoke Systems"; isAutomateMatch = true; }
        // 🌍 NEW: Telegram Automation Plans merged into the same list
        else if (userText === '6' || (userText.includes("telegram") && userText.includes("starter"))) { dynamicCategory = "Telegram Universal Automation - Starter Plan"; isAutomateMatch = true; }
        else if (userText === '7' || (userText.includes("telegram") && userText.includes("growth"))) { dynamicCategory = "Telegram Universal Automation - Growth Plan"; isAutomateMatch = true; }
        else if (userText === '8' || (userText.includes("telegram") && userText.includes("elite"))) { dynamicCategory = "Telegram Universal Automation - Elite Plan"; isAutomateMatch = true; }

        if (isAutomateMatch) {
            userSessions[from].step = 'ask_name_email';
            userSessions[from].projectScope = dynamicCategory;
            
            const liveDemoLinkText = "\n\n📲 *Live Demo Link:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo\n\n";

            let askDetailsText = (userLang === 'EN')
                ? (platform === 'telegram' ? `Excellent Selection: *${dynamicCategory}*. 🤖${liveDemoLinkText}📝 Kindly reply with your **Full Name, Email Address, and Mobile Number** to proceed.` : `Excellent Selection: *${dynamicCategory}*. 🤖${liveDemoLinkText}📝 Kindly reply with your **Full Name** and **Email Address** to proceed.`)
                : (platform === 'telegram' ? `Excellent Selection! Aapne *${dynamicCategory}* choose kiya hai. 🤖${liveDemoLinkText}📝 Ab kripya apna **Full Name, Email ID, aur Mobile Number** reply mein bheinje.` : `Excellent Selection! Aapne *${dynamicCategory}* choose kiya hai. 🤖${liveDemoLinkText}📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bheinje.`);
                
            return sendUnifiedMessage(from, askDetailsText, platform);
        } else {
            let fallbackMsg = (userLang === 'EN') ? "❌ Invalid selection. Reply from *1 to 8*." : "❌ Kripya list mein se sirf *1 se 8* ke beech koi number likhein.";
            return sendUnifiedMessage(from, fallbackMsg, platform);
        }
    }

    // 🎯 STATE 6: CONSULTATION FIXED SLOTS ROUTING (INTEGRATED SMART DATA MEMORY)
    if (currentStep === 'awaiting_consultation_slot') {
        const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
        let chosenOptionClean = userText.replace(/[\-\*•\(\)]/g, '').trim();
        
        // Capture existing details if they already passed them
        if (!userSessions[from].savedPlan) userSessions[from].savedPlan = userSessions[from].projectScope;
        const hasValidIdentity = userSessions[from].clientName && userSessions[from].clientName !== "Valued Client" && userSessions[from].clientEmail && userSessions[from].clientEmail !== "Not Provided" && userSessions[from].clientEmail !== "";
        
        if (chosenOptionClean === 'a' || chosenOptionClean.includes("today") || chosenOptionClean.includes("5")) {
            const dynamicSlotLabel = (currentHourIST >= 17) ? "Tomorrow at 5:00 PM" : "Today at 5:00 PM";
            userSessions[from].requestedSlot = dynamicSlotLabel; 
            sendAdminAlert(`🚨 *SLOT REQUEST!* 🚨\n📱 ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n⏰ Chosen Slot: ${dynamicSlotLabel}`);
            
            if (hasValidIdentity) {
                userSessions[from].step = 'post_registration';
                return finalizeConsultationLead(from, userSessions[from].savedPlan, null, platform);
            } else {
                userSessions[from].step = 'collect_consultation_identity'; 
                let idPrompt = (userLang === 'EN') 
                    ? (platform === 'telegram' ? "✍ *Please complete your profile:* Kindly reply with your *Full Name, Email Address, and Mobile Number* (separated by commas, e.g. John Doe, john@email.com, 9876543210)." : "✍ *Please complete your profile:* Kindly reply with your *Full Name and Email Address* (separated by a comma, e.g. John Doe, john@email.com).")
                    : (platform === 'telegram' ? "✍ *Apna profile register karein:* Kripya apna *Full Name, Email ID, aur Mobile Number* reply mein comma (,) lagakar ek sath bhejien (jaise: Sarfaraj Khan, sarfaraj@gmail.com, 9876543210)." : "✍ *Apna profile register karein:* Kripya apna *Full Name, Email ID* reply mein comma (,) lagakar ek sath bhejien (jaise: Sarfaraj Khan, sarfaraj@gmail.com).");
                return sendUnifiedMessage(from, idPrompt, platform);
            }
        } else if (chosenOptionClean === 'b' || chosenOptionClean.includes("tomorrow") || chosenOptionClean.includes("12")) {
            const dynamicSlotLabel = (currentHourIST >= 17) ? "Day After Tomorrow at 12:00 PM" : "Tomorrow at 12:00 PM";
            userSessions[from].requestedSlot = dynamicSlotLabel;
            sendAdminAlert(`🚨 *SLOT REQUEST!* 🚨\n📱 ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n⏰ Chosen Slot: ${dynamicSlotLabel}`);
            
            if (hasValidIdentity) {
                userSessions[from].step = 'post_registration';
                return finalizeConsultationLead(from, userSessions[from].savedPlan, null, platform);
            } else {
                userSessions[from].step = 'collect_consultation_identity'; 
                let idPrompt = (userLang === 'EN') 
                    ? (platform === 'telegram' ? "✍ *Please complete your profile:* Kindly reply with your *Full Name, Email Address, and Mobile Number* (separated by commas, e.g. John Doe, john@email.com, 9876543210)." : "✍ *Please complete your profile:* Kindly reply with your *Full Name and Email Address* (separated by a comma, e.g. John Doe, john@email.com).")
                    : (platform === 'telegram' ? "✍ *Apna profile register karein:* Kripya apna *Full Name, Email ID, aur Mobile Number* reply mein comma (,) lagakar ek sath bhejien (jaise: Sarfaraj Khan, sarfaraj@gmail.com, 9876543210)." : "✍ *Apna profile register karein:* Kripya apna *Full Name, Email ID* reply mein comma (,) lagakar ek sath bhejien (jaise: Sarfaraj Khan, sarfaraj@gmail.com).");
                return sendUnifiedMessage(from, idPrompt, platform);
            }
        } else if (chosenOptionClean === 'c' || chosenOptionClean.includes("custom")) {
            userSessions[from].step = 'awaiting_custom_time_input';
            userSessions[from].skipIdentityCapture = hasValidIdentity; // Setup pass tag
            return sendUnifiedMessage(from, (userLang === 'EN') ? "📅 *Custom Scheduling Activated!* \n\nPlease type your preferred **Date and Time** below (e.g., *Monday at 3 PM*):" : "📅 *Custom Scheduling Active!* \n\nKripya jis **Date aur Time** par aap call chahte hain, use niche type karke send karein (jaise: *Kal dopahar 3 baje*):", platform);
        }
    }

    // 🎯 STATE 8: CORE ENGINE - MAIN MENU ROUTER
    if (currentStep === 'welcome' || currentStep === 'main_menu') {
        userSessions[from].step = 'main_menu';
        let isCoreMatch = false; let targetMenuRoute = userText;

        if (userText === '1' || userText.includes("web") || userText.includes("site")) { targetMenuRoute = '1'; isCoreMatch = true; }
        else if (userText === '2' || userText.includes("automation") || userText.includes("retainer") || userText.includes("bot") || userText.includes("ai")) { targetMenuRoute = '2'; isCoreMatch = true; }
        else if (userText === '3' || userText.includes("deal") || userText.includes("discount")) { targetMenuRoute = '3'; isCoreMatch = true; }
        else if (userText === '4' || userText.includes("book") || userText.includes("token")) { targetMenuRoute = '4'; isCoreMatch = true; }
        else if (userText === '5' || userText.includes("shahid") || userText.includes("talk")) { targetMenuRoute = '5'; isCoreMatch = true; }

        if (!isCoreMatch) {
            let replyText = (userLang === 'EN')
                ? "Hello! Welcome to *Shahid Creatives*. 🚀 Select a stack tier layout:\n\n1️⃣ **Web Development Tiers**\n2️⃣ **AI-Powered Growth Retainers**\n3️⃣ **🔥 Exclusive Launch Deal**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid Creatives' Team (Direct Consultation)**"
                : "Hello! Welcome to *Shahid Creatives*. 🚀 Select layout choice number:\n\n1️⃣ *Web Development Tiers*\n2️⃣ *AI-Powered Growth Retainers*\n3️⃣ *🔥 Exclusive Launch Deal*\n4️⃣ *💳 Direct Booking & Token System*\n5️⃣ *👤 Talk to Shahid Creatives ki Team* (Direct Consultation)";
            return sendUnifiedMessage(from, replyText, platform);
        }

        if (targetMenuRoute === '1') {
            userSessions[from].step = 'process_requirement_menu'; 
            return sendUnifiedMessage(from, (userLang === 'EN') 
                ? "Please select what you want to build today by replying with option number:\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Custom Enterprise App ($2,499)" 
                : "Kripya select kijiye ki aap kya banwana chahte hain, reply mein number bheinjein:\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website (Online Store)** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)", platform);
        } else if (targetMenuRoute === '2') {
            userSessions[from].step = 'process_automation_menu';
            return sendUnifiedMessage(from, (userLang === 'EN')
                ? "🤖 **AI-Powered Growth Retainers & Telegram Bots**\nPlease reply with an option number (**1 to 8**):\n\n1️⃣ Starter Digital Maintainer ($77/Mo)\n2️⃣ Web Conversion Engine ($155/Mo)\n3️⃣ Omnichannel Growth Partner ($311/Mo)\n4️⃣ Full-Scale Ecosystem Operations ($499/Mo)\n5️⃣ Elite Intelligence & Bespoke Systems ($799/Mo)\n6️⃣ Telegram Universal Automation - Starter ($77/Mo)\n7️⃣ Telegram Universal Automation - Growth ($155/Mo)\n8️⃣ Telegram Universal Automation - Elite ($311/Mo)\n\n📲 *Live Demo:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo"
                : "🤖 **AI-Powered Growth Retainers & Telegram Bots**\nKripya niche diye gaye list mein se ek option number (**1 se 8**) ya naam reply kijiye:\n\n1️⃣ **Starter Digital Maintainer** (Base: ₹4,999/Mo)\n2️⃣ **Web Conversion Engine** (Base: ₹9,499/Mo)\n3️⃣ **Omnichannel Growth Partner** (Base: ₹18,999/Mo)\n4️⃣ **Full-Scale Ecosystem Operations** (Base: ₹29,999/Mo)\n5️⃣ **Elite Intelligence & Bespoke Systems** (Base: ₹49,999/Mo)\n6️⃣ **Telegram Universal Automation - Starter** (Base: ₹3,999/Mo)\n7️⃣ **Telegram Universal Automation - Growth** (Base: ₹7,599/Mo)\n8️⃣ **Telegram Universal Automation - Elite** (Base: ₹15,199/Mo)\n\n📲 *Live Demo Link:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo", platform);
        } else if (targetMenuRoute === '3') {
            userSessions[from].step = 'process_requirement_menu';
            return sendUnifiedMessage(from, (userLang === 'EN')
                ? "🔥 *Exclusive Launch Offer Active!* (Flat 20% OFF Code Applied)\n\nPlease select your project requirement number to secure your discounted slot:\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Custom Enterprise App ($2,499)"
                : "🔥 *Exclusive Launch Offer Active!* (Flat 20% OFF Coupon apply kar diya gaya hai)\n\nAap jis requirement par discount lock karna chahte hain, kripya uska number reply kijiye:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)", platform);
        } else if (targetMenuRoute === '4') {
            userSessions[from].step = 'process_requirement_menu';
            return sendUnifiedMessage(from, (userLang === 'EN')
                ? "💳 *Direct Booking & Token System ($49)*\n\nPlease select the project type you want to lock slot for via option number:\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Custom Enterprise App ($2,499)"
                : "💳 *Direct Booking & Token System (₹999 Slot Lock)*\n\nAap jis project layout ke liye secure token register karna chahte hain, kripya uska option number bheinje:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)", platform);
        } else if (targetMenuRoute === '5') {
            userSessions[from].step = 'awaiting_consultation_slot';
            const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
            
            const optionA = (currentHourIST >= 17) ? "🅰️ *Kal Shaam 5:00 Baje*" : "🅰️ *Aaj Shaam 5:00 Baje*";
            const optionB = (currentHourIST >= 17) ? "🅱️ *Parso Dopahar 12:00 Baje*" : "🅱️ *Kal Dopahar 12:00 Baje*";
            const optionA_EN = (currentHourIST >= 17) ? "🅰️ *Tomorrow at 5:00 PM*" : "🅰️ *Today at 5:00 PM*";
            const optionB_EN = (currentHourIST >= 17) ? "🅱️ *Day After Tomorrow at 12:00 PM*" : "🅱️ *Tomorrow at 12:00 PM*";

            return sendUnifiedMessage(from, (userLang === 'EN') 
                ? `👤 *Direct Consultation with Shahid Creatives' Team:*\n\n${optionA_EN}\n${optionB_EN}\n🅲️ *Custom Time (Type preferred time below)*\n\n👉 Reply with A, B, or C!` 
                : `👤 *Direct Consultation with Shahid Creatives ki Team:*\n\n${optionA}\n${optionB}\n🅲️ *Custom Time (Apna secure timing niche type karein)*\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye!`, platform);
        }
    }
}

// 🎯 REUSABLE LOGIC: FINALIZE CONSULTATION LEAD
async function finalizeConsultationLead(from, textInput, res, platform) {
    const session = userSessions[from];
    const cleanName = session.clientName || "Valued Client";
    const clientEmail = session.clientEmail || "Not Provided";
    const dynamicSlot = session.requestedSlot || "Direct Scheduled Request";
    const userLang = session.lang;

    // Fetch Phone: Use explicitly collected phone if available, else fallback
    const displayPhone = session.clientPhone || (platform === 'whatsapp' ? from : "Not Provided");

    const isUSDTrack = (userLang === 'EN'); 
    const matchedBasePriceStr = getBasePriceByPlan(textInput, isUSDTrack);
    const matchedBasePrice = parseFloat(matchedBasePriceStr);
    
    // 🎯 ADMIN NOTIFICATION UPDATE: Syncs with Base Price discount logic
    const savingAmount = Math.round(matchedBasePrice * 0.20);
    const discountedBasePrice = matchedBasePrice - savingAmount;
    const finalCalculatedPrice = calculateTotalPayable(discountedBasePrice, isUSDTrack);
    
    const currency = isUSDTrack ? '$' : '₹';
    const taxLabel = isUSDTrack ? 'incl Gateway Fees' : 'incl GST';

    const comprehensiveAdminAlert = `🚨 *PRE-QUALIFIED B2B CONSULTATION LEAD!* 🚨\n\n📱 *Client Contact:* ${displayPhone} ${platform === 'telegram' ? '(Telegram)' : '(WhatsApp)'}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${cleanName}\n✉️ *Email:* ${clientEmail}\n📝 *Slot Details & Parameters:* Direct Consultation Slot: ${dynamicSlot}\n💬 *User Stated Objectives:* "${textInput}"\n💵 *Base Price:* ${currency}${matchedBasePrice}\n🔥 *Discount Applied:* ${currency}${savingAmount} (LAUNCH20)\n💰 *Calculated Price:* ${currency}${finalCalculatedPrice} (${taxLabel})\n\n🤖 *Status:* Live details captured securely!`;
    sendAdminAlert(comprehensiveAdminAlert); // Omnichannel Admin Alert

    const targetEndpoint = 'https://shahidcreatives.com/api/whatsapp-leads';

    try {
        await axios.post(targetEndpoint, {
            client_name: cleanName,
            whatsapp_number: displayPhone,
            telegram_chat_id: platform === 'telegram' ? from : undefined,
            email: clientEmail,
            requested_slot: dynamicSlot,
            discussion_notes: `*User Stated Objectives:* "${textInput}"\n\n${comprehensiveAdminAlert}`, // ✅ SYNCED WITH NEW PARSER LOGIC
            project_scope: textInput, 
            calculated_price: finalCalculatedPrice 
        });
    } catch (apiErr) { console.error("Dashboard parameters execution failure handler."); }

    let confirmationText = (userLang === 'EN')
        ? `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Your specifications have been securely routed to Shahid Creatives. We will connect with you shortly! 🚀\n\n🌐 _Powered by Shahid Creatives_`
        : `✅ *Booking Profile Complete!* \n\nThank you *${cleanName}*! Aapka requirement details Shahid Creatives ki Team tak pahunch gaya hai. Hamari team aapse jald hi raabta karegi! 🚀\n\n🌐 _Powered by Shahid Creatives_`;
    return sendUnifiedMessage(from, confirmationText, platform);
}

// 🛡️ OMNICHANNEL MESSAGE SENDER (Translates WhatsApp Formatting to Telegram)
async function sendUnifiedMessage(to, text, platform, options = null) {
    if (platform === 'telegram') {
        try {
            // Converts WhatsApp Bold (*text*) to Telegram HTML (<b>text</b>) to prevent parser crash
            let htmlText = text
                .replace(/\*(.*?)\*/g, '<b>$1</b>')
                .replace(/_(.*?)_/g, '<i>$1</i>');
                
            let tgOptions = { parse_mode: "HTML" };
            if (options && options.reply_markup) {
                tgOptions.reply_markup = options.reply_markup;
            }
                
            await bot.sendMessage(to, htmlText, tgOptions);
        } catch (e) {
            await bot.sendMessage(to, text); // Absolute safe fallback
        }
    } else {
        await sendWhatsAppMessage(to, text);
    }
}

// 🛡️ MULTI-CHANNEL ADMIN ALERT SYSTEM
async function sendAdminAlert(text) {
    // 1. Send to WhatsApp Admin
    const WHATSAPP_ADMIN_NUMBER = "917529839762";
    await sendWhatsAppMessage(WHATSAPP_ADMIN_NUMBER, text);
    
    // 2. Send to Telegram Admin
    const TELEGRAM_ADMIN_ID = "8885973325"; 
    
    try {
        let htmlText = text
            .replace(/\*(.*?)\*/g, '<b>$1</b>')
            .replace(/_(.*?)_/g, '<i>$1</i>');
        await bot.sendMessage(TELEGRAM_ADMIN_ID, htmlText, { parse_mode: "HTML" });
    } catch (e) {
        console.error("Telegram Admin Alert Delivery Note: You must put your NUMERIC Chat ID instead of @username.", e.message);
        bot.sendMessage(TELEGRAM_ADMIN_ID, text).catch(err => {});
    }
}

async function sendWhatsAppMessage(to, text) {
    const SECURED_ACCESS_TOKEN = "EAAOT5XBXyVwBR7v5XwYnbITF4zF3xWzQXikBjAH1w2qu0sQTbVkyqpNvmRAqhkmU7BqCEcthw5CHelfzr3fmDF2C3la6lw28iYLPI3EmZAZC6vDQoHQyiZAKz7QmfuiZBh0TKhusnrH6CeJZBJLdwU30MOzyr7Vkn26w5dE4md74Bu4OwoLzqfmCCtFDZA9AZDZD"; 
    const DEFAULT_PHONE_NUMBER_ID = "1202984902891472"; 
    try {
        await axios({
            method: "POST", 
            url: `https://graph.facebook.com/v18.0/${DEFAULT_PHONE_NUMBER_ID}/messages`,
            data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } },
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECURED_ACCESS_TOKEN}` }
        });
    } catch (e) { 
        console.error("WhatsApp API dispatch error:", e.response ? JSON.stringify(e.response.data) : e.message); 
    }
} 

const PORT = process.env.PORT || 10000; 
app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChatBot engine live on port ${PORT}`);
    console.log("✅ Original Telegram Bot Active!");
    console.log("✅ Salon Telegram Bot Active!");
    console.log("✅ Zam Zam Clinic Bot Active!");
    console.log("✅ WhatsApp Webhook Active!");
});
