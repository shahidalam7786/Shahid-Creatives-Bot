require('dotenv').config();

process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const express = require('express');
const bodyParser = require('body-parser'); 
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api'); 
const nodemailer = require('nodemailer'); 

// ==========================================
// 🛡️ GLOBAL ANTI-CRASH SYSTEM (KEEPS SERVER ALIVE 24/7)
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
    console.log('Unhandled Rejection Ignored:', reason);
});
process.on('uncaughtException', (err) => {
    console.log('Uncaught Exception Ignored:', err.message);
});
process.on('uncaughtExceptionMonitor', (err, origin) => {
    console.log('Uncaught Exception Monitor:', err.message);
});

const app = express();
app.use(bodyParser.json());

// ==========================================
// 📧 GOOGLE WORKSPACE SMTP TRANSPORTER (FROM .ENV)
// ==========================================
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER || 'contact@shahidcreatives.com',
        pass: process.env.SMTP_PASS || 'lirfzonjgyaadznj'
    }
});

// ==========================================
// 🚀 GLOBAL SCHEDULING & REMINDER ENGINE
// ==========================================
const bookedSlots = { salon: {}, clinic: {}, consultation_hourly: {} }; 
const activeAppointments = []; 
let mainAdminState = null; 

const processingLocks = {};

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

        const slotKey = `${selectedDateStr}_${t}`;
        const count = bookedSlots[botType][slotKey] || 0;
        if (count >= 4) return; 

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
// 🚀 1. TELEGRAM BOT SETUP
// ==========================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8563313484:AAG9McxPMQkHSiTCjA0HjUzJ3P6e8pgkcDw';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '8885973325';

bot.on('polling_error', (error) => {
    console.log("Original Telegram Polling Error (Ignored):", error.message);
});
bot.on('error', (error) => {
    console.log("Original Telegram General Error:", error.message);
});

bot.on('callback_query', async (query) => {
    bot.answerCallbackQuery(query.id).catch(()=>{}); 
    if (!query.message) return;
    
    const chatId = query.message.chat.id.toString();
    const data = query.data;

    if (data.startsWith('admin_cons_')) {
        const parts = data.split('_');
        const action = parts[2]; 
        const clientChatId = parts.slice(3).join('_');
        
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message.message_id }).catch(()=>{});
        
        if (action === 'confirm') {
            bot.sendMessage(chatId, `✅ *STATUS: BOOKING CONFIRMED BY ADMIN*\nClient ID: \`${clientChatId}\``, { parse_mode: 'Markdown' }).catch(()=>{});
            
            const clientPlatform = (userSessions[clientChatId] && userSessions[clientChatId].platform) ? userSessions[clientChatId].platform : (clientChatId.includes('91') || clientChatId.length > 10 ? 'whatsapp' : 'telegram');
            const clientLang = userSessions[clientChatId] ? userSessions[clientChatId].lang : 'EN';
            
            const confirmMsg = clientLang === 'EN' 
                ? `🎉 *Consultation Confirmed!*\n\nYour strategy call slot has been successfully verified by our team. We will call you exactly at your requested time! 🚀\n\n🌐 _Powered by Shahid Creatives_`
                : `🎉 *Consultation Confirmed!*\n\nHumari team ne aapka strategy call slot verify aur confirm kar diya hai. Hum theek aapke diye hue samay par raabta karenge! 🚀\n\n🌐 _Powered by Shahid Creatives_`;
            
            await sendUnifiedMessage(clientChatId, confirmMsg, clientPlatform);
            
        } else if (action === 'resched') {
            mainAdminState = clientChatId;
            bot.sendMessage(chatId, `🔄 *STATUS: PENDING RESCHEDULE UPDATE*\n\n⚠️ Aapne Client (${clientChatId}) ke liye *Reschedule/Message* chuna hai.\n\n👉 *Kripya naya Time ya Message type karke bhejein:*\n_(Yeh message seedha client ko bhej diya jayega)_`, { parse_mode: "Markdown" }).catch(()=>{});
        }
        return;
    }

    if (data.startsWith('cons_time_')) {
        const selectedTime = data.replace('cons_time_', '');
        await processUnifiedMessage(chatId, `Custom Time: ${selectedTime}`, 'telegram');
    }
    else if (data.startsWith('sel_web_') || data.startsWith('sel_ai_') || data.startsWith('sel_combo_') || data.startsWith('sel_app_') || data.startsWith('sel_meta_')) {
        const number = data.split('_')[2];
        await processUnifiedMessage(chatId, number, 'telegram');
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    if (!text) return;

    if (chatId === ADMIN_CHAT_ID && mainAdminState) {
        const clientChatId = mainAdminState;
        const clientPlatform = (userSessions[clientChatId] && userSessions[clientChatId].platform) ? userSessions[clientChatId].platform : (clientChatId.includes('91') || clientChatId.length > 10 ? 'whatsapp' : 'telegram');
        const clientLang = userSessions[clientChatId] ? userSessions[clientChatId].lang : 'EN';
        const isEn = clientLang === 'EN';

        const updateMsg = isEn 
            ? `⚠️ *Update from Shahid Creatives*\n\nSorry, your previously selected slot is unavailable. Our Team has an update for you:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`
            : `⚠️ *Update from Shahid Creatives*\n\nMaafi chahte hain, aapka chuna hua slot available nahi hai. Humari team ka naya sandesh:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`;
        
        await sendUnifiedMessage(clientChatId, updateMsg, clientPlatform);
        bot.sendMessage(chatId, `✅ Update sent successfully to Client!`, { parse_mode: 'Markdown' }).catch(()=>{});
        mainAdminState = null; 
        return;
    }

    if (processingLocks[chatId]) return;
    processingLocks[chatId] = true;

    try {
        await processUnifiedMessage(chatId, text, 'telegram');
    } finally {
        delete processingLocks[chatId];
    }
});

// ==========================================
// ✨ SALON AI VIRTUAL RECEPTIONIST BOT
// ==========================================
const SALON_TELEGRAM_TOKEN = process.env.SALON_TELEGRAM_TOKEN || '8602924285:AAGRgdN8F6pr5BhzCysFaM8uXoXNo93gyeY';
const salonBot = new TelegramBot(SALON_TELEGRAM_TOKEN, { polling: true });
const SALON_ADMIN_CHAT_ID = ADMIN_CHAT_ID;

salonBot.on('polling_error', (error) => {
    console.log("Salon Bot Polling Error (Ignored):", error.message);
});
salonBot.on('error', (error) => {
    console.log("Salon Bot General Error (Ignored):", error.message);
});

const salonSessions = {};
let salonAdminState = null;

salonBot.on('callback_query', async (query) => {
    salonBot.answerCallbackQuery(query.id).catch(()=>{}); 
    if (!query.message) return;
    
    const chatId = query.message.chat.id.toString();
    const data = query.data;
    const messageId = query.message.message_id;

    try {
        if (chatId === SALON_ADMIN_CHAT_ID && data.startsWith('admin_sln_')) {
            const parts = data.split('_'); 
            const action = parts[2]; 
            const clientChatId = parts[3]; 

            salonBot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(()=>{});

            if (action === 'confirm') {
                salonBot.sendMessage(chatId, `✅ *STATUS: BOOKING CONFIRMED BY YOU*\nClient: \`${clientChatId}\``, { parse_mode: "Markdown" }).catch(()=>{});
                salonBot.sendMessage(clientChatId, "🎉 *Great News!*\n\nYour appointment has been *CONFIRMED* by the salon. Hum aapka intezaar kar rahe hain! ✨\n\n🌐 _Powered by Shahid Creatives_", { parse_mode: "Markdown" }).catch(()=>{});
            } else if (action === 'resched') {
                salonAdminState = clientChatId;
                salonBot.sendMessage(chatId, `🔄 *STATUS: PENDING TIME UPDATE*\n\n⚠️ Aapne Client (${clientChatId}) ke liye *Reschedule* chuna hai.\n\n👉 *Kripya naya Time ya Message type karke bhejein:*\n_(Yeh message seedha client ko bhej diya jayega)_`, { parse_mode: "Markdown" }).catch(()=>{});
            }
            return;
        }

        if (!salonSessions[chatId]) salonSessions[chatId] = { step: 'start' };
        const session = salonSessions[chatId];

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
        else if (data.startsWith('sln_spec_')) {
            session.specialist = data.replace('sln_spec_', '');
            session.step = 'AWAITING_HAIRSTYLE_DETAILS';
            const isEn = session.lang === 'EN';
            
            const detailsPrompt = isEn
                ? `You selected: *${session.specialist}*\n\nPlease describe what specific hairstyle or improvement you need (e.g., Party styling, Hairfall treatment, Highlight touchup): ✍️`
                : `Aapne chuna hai: *${session.specialist}*\n\nKripya batayein aapko kis tarah ki hairstyle ya improvement chahiye (jaise: Party styling, Hairfall treatment): ✍️`;
            
            await salonBot.editMessageText(detailsPrompt, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
        }

    } catch(err) { console.log(err.message); }
});

salonBot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    let text = msg.text;
    if (msg.contact) { text = msg.contact.phone_number; }
    if (!text) return; 

    try {
        if (chatId === SALON_ADMIN_CHAT_ID && salonAdminState) {
            const clientChatId = salonAdminState;
            const clientLang = salonSessions[clientChatId] ? salonSessions[clientChatId].lang : 'HIN';
            const isEn = clientLang === 'EN';

            const updateMsg = isEn 
                ? `⚠️ *Update from Salon*\n\nSorry, your previous slot is unavailable. The Admin has set a new time for you:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`
                : `⚠️ *Update from Salon / Salon se Sandesh*\n\nMaafi chahte hain, aapka purana slot available nahi hai. Admin ne aapka naya samay tay kiya hai:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`;
            
            await salonBot.sendMessage(clientChatId, updateMsg, { parse_mode: 'Markdown' });
            await salonBot.sendMessage(chatId, `✅ Update sent successfully to Client!`, { parse_mode: 'Markdown' });
            salonAdminState = null; 
            return;
        }

        const lowerText = text.toLowerCase();
        const resetTriggers = ['hi', 'hello', 'hey', 'start', '/start', 'menu'];

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

        if (step === 'AWAITING_SERVICE_BTN') return salonBot.sendMessage(chatId, isEn ? "Please select a service using the buttons above. 👇" : "Kripya upar diye gaye buttons par click karke apni service select karein. 👇");
        if (step === 'AWAITING_DATE_BTN') return salonBot.sendMessage(chatId, isEn ? "Please click the Date buttons (Today/Tomorrow) above. 👇" : "Kripya Date select karne ke liye upar diye gaye (Today/Tomorrow) buttons par click karein. 👇");
        if (step === 'AWAITING_TIME_BTN') return salonBot.sendMessage(chatId, isEn ? "Please select your Time Slot from the buttons above. 👇" : "Kripya Time select karne ke liye upar diye gaye Time Slot buttons par click karein. 👇");
        if (step === 'AWAITING_SPECIALIST') return salonBot.sendMessage(chatId, isEn ? "Please select your preferred Specialist from the buttons above. 👇" : "Kripya Specialist select karne ke liye upar diye gaye buttons par click karein. 👇");

        if (step === 'AWAITING_HAIRSTYLE_DETAILS') {
            session.hairstyleDetails = text;
            session.step = 'COLLECT_NAME';
            const namePrompt = isEn ? `Noted! Now please type and send your Full Name. ✨` : `Noted! Ab kripya apna Full Name type karke bhejein. ✨`;
            return salonBot.sendMessage(chatId, namePrompt, { parse_mode: "Markdown" });
        }

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

        if (step === 'COLLECT_PHONE') {
            session.phone = text; 
            session.step = 'COMPLETED';

            const slotKey = `${session.date}_${session.time}`;
            bookedSlots.salon[slotKey] = (bookedSlots.salon[slotKey] || 0) + 1;

            const apptTimestamp = getApptTimestamp(session.date, session.time);
            const diffMs = apptTimestamp - Date.now();
            const diffHoursInitial = diffMs / (1000 * 60 * 60);

            activeAppointments.push({
                bot: 'salon', chatId, lang: session.lang,
                timestamp: apptTimestamp,
                clientName: session.name,
                reminded: { 
                    '10': diffHoursInitial <= 10, 
                    '2': diffHoursInitial <= 2,   
                    '1': diffHoursInitial <= 1    
                }
            });
            
            const receiptMsg = isEn 
                ? `🎉 *Booking Request Sent!*\n\nHello *${session.name}*, your appointment request has been successfully received.\n\n🧾 *Booking Summary:*\n📅 *Date & Time:* ${session.dateTime}\n💇‍♀️ *Service:* ${session.service}\n💰 *Price:* ${session.price}\n👨‍🎨 *Specialist:* ${session.specialist}\n\n👤 *Client Details:*\n    ▫️ *Name:* ${session.name}\n    ▫️ *Contact:* ${session.phone}\n    ▫️ *Pre-details:* ${session.hairstyleDetails}\n\n📍 *Location:* Phase 11, Mohali\n🗺️ *GPS Location:* [Navigate Here](https://www.google.com/maps/dir//Ground+Floor,+Fit+hair+artist+Unisex+Family+Salon,+SCO+50,+Phase+11,+Sector+65,+Sahibzada+Ajit+Singh+Nagar,+Punjab+160062/@30.6811159,76.7420617,822m/data=!3m1!1e3!4m17!1m7!3m6!1s0x390fed26d2a12c33:0xbc77237be76b2e81!2sFit+hair+artist+Unisex+Family+Salon!8m2!3d30.6811113!4d76.744642!16s%2Fg%2F11wtm3plgb!4m8!1m0!1m5!1m1!1s0x390fed26d2a12c33:0xbc77237be76b2e81!2m2!1d76.744642!2d30.6811113!3e0?entry=ttu&g_ep=EgoyMDI2MDcxNS4wIKXMDSoASAFQAw%3D%3D)\n\n_Our team will contact you shortly for final confirmation._ ✨\n\n🌐 _Powered by Shahid Creatives_`
                : `🎉 *Booking Request Sent!*\n\nNamaste *${session.name}*, aapki appointment request successfully receive ho gayi hai.\n\n🧾 *Booking Summary:*\n📅 *Date & Time:* ${session.dateTime}\n💇‍♀️ *Service:* ${session.service}\n💰 *Price:* ${session.price}\n👨‍🎨 *Specialist:* ${session.specialist}\n\n👤 *Client Details:*\n    ▫️ *Name:* ${session.name}\n    ▫️ *Contact:* ${session.phone}\n    ▫️ *Pre-details:* ${session.hairstyleDetails}\n\n📍 *Location:* Phase 11, Mohali\n🗺️ *GPS Location:* [Navigate Here](https://www.google.com/maps/dir//Ground+Floor,+Fit+hair+artist+Unisex+Family+Salon,+SCO+50,+Phase+11,+Sector+65,+Sahibzada+Ajit+Singh+Nagar,+Punjab+160062/@30.6811159,76.7420617,822m/data=!3m1!1e3!4m17!1m7!3m6!1s0x390fed26d2a12c33:0xbc77237be76b2e81!2sFit+hair+artist+Unisex+Family+Salon!8m2!3d30.6811113!4d76.744642!16s%2Fg%2F11wtm3plgb!4m8!1m0!1m5!1m1!1s0x390fed26d2a12c33:0xbc77237be76b2e81!2m2!1d76.744642!2d30.6811113!3e0?entry=ttu&g_ep=EgoyMDI2MDcxNS4wIKXMDSoASAFQAw%3D%3D)\n\n_Humari team jald hi aapse final confirmation ke liye sampark karegi._ ✨\n\n🌐 _Powered by Shahid Creatives_`;
            
            salonBot.sendMessage(chatId, receiptMsg, { parse_mode: "Markdown", disable_web_page_preview: true, reply_markup: { remove_keyboard: true } });

            try {
                const webhookPayload = {
                    projectId: "CREATIVE-106",
                    name: session.name,
                    phone: session.phone,
                    email: "Not Provided",
                    project_type: "Fit hair artist Unisex Family Salon",
                    notes: `Service: ${session.service}, Specialist: ${session.specialist}, Slot: ${session.dateTime}, Client Notes: ${session.hairstyleDetails}`,
                    source: "@AI_Virtual_Receptionist_bot"
                };

                await axios.post('https://shahidcreatives.com/api/bot-leads?projectId=CREATIVE-106', webhookPayload, {
                    headers: { 'Content-Type': 'application/json' }
                });
            } catch (webhookErr) {}

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
    } catch(err) { console.log(err.message); }
});

// ==========================================
// ✨ ZAM ZAM CLINIC VIRTUAL RECEPTIONIST BOT
// ==========================================
const ZAMZAM_TELEGRAM_TOKEN = process.env.ZAMZAM_TELEGRAM_TOKEN || '8707737273:AAEIKAFSF4pxb3gKnbQTNZVxhwEKaYE_mE0';
const zamZamBot = new TelegramBot(ZAMZAM_TELEGRAM_TOKEN, { polling: true });
const ZAMZAM_ADMIN_CHAT_ID = ADMIN_CHAT_ID; 

zamZamBot.on('polling_error', (error) => {
    console.log("Zam Zam Bot Polling Error (Ignored):", error.message);
});
zamZamBot.on('error', (error) => {
    console.log("Zam Zam Bot General Error (Ignored):", error.message);
});

const zamzamSessions = {};
let zamzamAdminState = null; 

zamZamBot.on('callback_query', async (query) => {
    zamZamBot.answerCallbackQuery(query.id).catch(()=>{}); 
    if (!query.message) return;

    const chatId = query.message.chat.id.toString();
    const data = query.data;
    const messageId = query.message.message_id;

    try {
        if (chatId === ZAMZAM_ADMIN_CHAT_ID && data.startsWith('admin_zz_')) {
            const parts = data.split('_'); 
            const action = parts[2]; 
            const clientChatId = parts[3]; 

            zamZamBot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: messageId }).catch(()=>{});

            if (action === 'confirm') {
                zamZamBot.sendMessage(chatId, `✅ *STATUS: BOOKING CONFIRMED BY YOU*\nPatient: \`${clientChatId}\``, { parse_mode: "Markdown" }).catch(()=>{});
                zamZamBot.sendMessage(clientChatId, "🎉 *Great News!*\n\nAapki appointment Clinic dwara *CONFIRM* kar di gayi hai. Kripya samay par pahuchein! 🩺\n\n🌐 _Powered by Shahid Creatives_", { parse_mode: "Markdown" }).catch(()=>{});
            } else if (action === 'resched') {
                zamzamAdminState = clientChatId; 
                zamZamBot.sendMessage(chatId, `🔄 *STATUS: PENDING TIME UPDATE*\n\n⚠️ Aapne Patient (${clientChatId}) ke liye *Reschedule/Update Time* chuna hai.\n\n👉 *Kripya naya Time ya Message type karke bhejein:*\n_(Yeh message seedha patient ko bhej diya jayega)_`, { parse_mode: "Markdown" }).catch(()=>{});
            }
            return;
        }

        if (!zamzamSessions[chatId]) zamzamSessions[chatId] = { step: 'start', lang: 'HIN' };
        const session = zamzamSessions[chatId];
        const isEn = session.lang === 'EN';

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
        else if (data === 'timings') {
            const timingMsg = isEn 
                ? `🕒 *Zam Zam Clinic - Timings*\n\n🌅 *Morning:* 8:00 AM - 2:00 PM\n🌆 *Evening:* 4:00 PM - 10:00 PM\n_Monday to Sunday_`
                : `🕒 *Zam Zam Clinic - Timings*\n\n🌅 *Subah:* 8:00 AM se 2:00 PM\n🌆 *Shaam:* 4:00 PM se 10:00 PM\n_Monday to Sunday_`;
            zamZamBot.sendMessage(chatId, timingMsg, { parse_mode: 'Markdown' });
        } 
        else if (data === 'location') {
            const locMsg = isEn 
                ? `📍 *Zam Zam Clinic - Address*\n\nStreet Number 1, Wall Singh Nagar Rd, Barsal Nagar, Bal Singh Nagar, Ludhiana, Punjab 141007\n\n🗺️ *Map:* [View on Google Maps](https://www.google.com/maps/search/?api=1&query=Zam%20Zam%20Clinic&query_place_id=ChIJ6YeKEnuDGjkRKeQcbhpwlWI)`
                : `📍 *Zam Zam Clinic - Address*\n\nStreet Number 1, Wall Singh Nagar Rd, Bal Singh Nagar, Ludhiana, Punjab 141007\n\n🗺️ *Map:* [Google Maps Par Dekhein](https://www.google.com/maps/search/?api=1&query=Zam%20Zam%20Clinic&query_place_id=ChIJ6YeKEnuDGjkRKeQcbhpwlWI)`;
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
        else if (data === 'book') {
            session.step = 'AWAITING_DATE';
            const dateOptions = {
                inline_keyboard: [
                    [{ text: "📅 Today", callback_data: "zz_date_today" }, { text: "📅 Tomorrow", callback_data: "zz_date_tomorrow" }]
                ]
            };
            const dateMsg = isEn 
                ? `📅 *Appointment Booking:*\n\nPlease select your preferred *Date* first: 👇`
                : `📅 *Appointment Booking:*\n\nKripya pehle preferred *Date* select karein: 👇`;
            zamZamBot.sendMessage(chatId, dateMsg, { parse_mode: 'Markdown', reply_markup: dateOptions });
        } 
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
        else if (data.startsWith('zz_doc_')) {
            session.doctor = data.replace('zz_doc_', '');
            session.step = 'AWAITING_PROBLEM_DETAILS';
            const isEn = session.lang === 'EN';
            
            const probPrompt = isEn 
                ? `Doctor selected: *Dr. ${session.doctor}*\n\nPlease briefly describe your problem and since when you are facing it. ✍️\n_(Example: Fever and headache since 2 days)_`
                : `Doctor selected: *Dr. ${session.doctor}*\n\nKripya batayein aapko kya problem hai aur kitne time se hai. ✍️\n_(Udaharan: 2 din se bukhar aur sir dard)_`;
                
            zamZamBot.editMessageText(probPrompt, { chat_id: chatId, message_id: messageId, parse_mode: "Markdown" });
        }

    } catch(err) { console.log(err.message); }
});

zamZamBot.on('message', async (msg) => {
    const chatId = msg.chat.id.toString();
    const text = msg.text;

    if (!text) return;

    try {
        if (chatId === ZAMZAM_ADMIN_CHAT_ID && zamzamAdminState) {
            const clientChatId = zamzamAdminState;
            const clientLang = zamzamSessions[clientChatId] ? zamzamSessions[clientChatId].lang : 'HIN';
            const isEn = clientLang === 'EN';

            const updateMsg = isEn 
                ? `⚠️ *Update from Clinic*\n\nSorry, your previous slot is unavailable. The Doctor/Admin has set a new time for you:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`
                : `⚠️ *Update from Clinic / Clinic se Sandesh*\n\nMaafi chahte hain, aapka purana slot available nahi hai. Doctor/Admin ne aapka naya samay tay kiya hai:\n\n🔄 *Updated Time/Message:*\n${text}\n\n🌐 _Powered by Shahid Creatives_`;
            
            await zamZamBot.sendMessage(clientChatId, updateMsg, { parse_mode: 'Markdown' });
            await zamZamBot.sendMessage(chatId, `✅ Update sent successfully to Patient!`, { parse_mode: 'Markdown' });
            zamzamAdminState = null; 
            return;
        }

        const lowerText = text.toLowerCase();
        const triggers = ['hi', 'hello', 'hey', 'start', '/start', 'menu'];

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

        if (session.step === 'AWAITING_PROBLEM_DETAILS') {
            session.problem = text;
            session.step = 'COLLECT_DETAILS';
            
            const detailsMsg = isEn 
                ? `Noted!\n\nNow please type and send your *Name, Age, Gender, and Mobile Number* separated by commas.\n\n_(Example: Shahid Alam, 30, Male, 9097617846)_`
                : `Noted!\n\nAb kripya apna *Naam, Umar (Age), Gender, aur Mobile Number* ek hi message mein comma lagakar bhejein.\n\n_(Udaharan: Shahid Alam, 30, Male, 9097617846)_`;

            return zamZamBot.sendMessage(chatId, detailsMsg, { parse_mode: "Markdown" });
        }

        if (session && session.step === 'COLLECT_DETAILS') {
            const userName = msg.from.first_name || 'User';
            const userUsername = msg.from.username ? `@${msg.from.username}` : 'No Username';

            let detailsArr = text.split(/[,|\n]+/).map(s => s.trim());
            let formattedPatientDetails = "";
            
            if (detailsArr.length >= 3) {
                formattedPatientDetails = `\n    ▫️ *Name:* ${detailsArr[0]}\n    ▫️ *Age:* ${detailsArr[1]}`;
                if (detailsArr.length >= 4) {
                     formattedPatientDetails += `\n    ▫️ *Gender:* ${detailsArr[2]}\n    ▫️ *Mobile:* ${detailsArr[3]}`;
                } else {
                     formattedPatientDetails += `\n    ▫️ *Mobile:* ${detailsArr[2]}`;
                }
            } else {
                formattedPatientDetails = `\n    ▫️ *Info:* ${text}`;
            }

            const slotKey = `${session.date}_${session.time}`;
            bookedSlots.clinic[slotKey] = (bookedSlots.clinic[slotKey] || 0) + 1;

            const apptTimestamp = getApptTimestamp(session.date, session.time);
            const diffMs = apptTimestamp - Date.now();
            const diffHoursInitial = diffMs / (1000 * 60 * 60);

            activeAppointments.push({
                bot: 'clinic', chatId, lang: session.lang,
                timestamp: apptTimestamp,
                clientName: (detailsArr[0] || userName),
                reminded: { 
                    '10': diffHoursInitial <= 10, 
                    '2': diffHoursInitial <= 2,   
                    '1': diffHoursInitial <= 1    
                }
            });

            const clientReceipt = isEn 
                ? `🎉 *Appointment Request Sent!*\n\nHello *${userName}*, your appointment request has been successfully received.\n\n🧾 *Booking Summary:*\n📅 *Date:* ${session.date}\n⏰ *Time:* ${session.time}\n👨‍⚕️ *Doctor:* Dr. ${session.doctor}\n👤 *Patient Details:*${formattedPatientDetails}\n📝 *Current Problem:* ${session.problem}\n💰 *Clinic Appoint Fee:* 500/- INR\n📍 *Location:* Zam Zam Clinic\n🗺️ *GPS Location:* [Navigate Here](https://www.google.com/maps/search/?api=1&query=Zam%20Zam%20Clinic&query_place_id=ChIJ6YeKEnuDGjkRKeQcbhpwlWI)\n\nOur team will contact you shortly for final confirmation. 🙏\n\n🌐 _Powered by Shahid Creatives_`
                : `🎉 *Appointment Request Sent!*\n\nNamaste *${userName}*, aapki appointment request successfully receive ho gayi hai.\n\n🧾 *Booking Summary:*\n📅 *Date:* ${session.date}\n⏰ *Time:* ${session.time}\n👨‍⚕️ *Doctor:* Dr. ${session.doctor}\n👤 *Patient Details:*${formattedPatientDetails}\n📝 *Current Problem:* ${session.problem}\n💰 *Clinic Appoint Fee:* 500/- INR\n📍 *Location:* Zam Zam Clinic\n🗺️ *GPS Location:* [Navigate Here](https://www.google.com/maps/search/?api=1&query=Zam%20Zam%20Clinic&query_place_id=ChIJ6YeKEnuDGjkRKeQcbhpwlWI)\n\nHumari team jald hi aapse final confirmation ke liye sampark karegi. Kripya samay par clinic pahuchein. 🙏\n\n🌐 _Powered by Shahid Creatives_`;

            zamZamBot.sendMessage(chatId, clientReceipt, { parse_mode: 'Markdown', disable_web_page_preview: true });

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

            session.step = 'COMPLETED';
        }
    } catch(err) { console.log(err.message); }
});

setInterval(() => {
    const now = Date.now();
    activeAppointments.forEach(appt => {
        const diffMs = appt.timestamp - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 0) return; 
        
        let shouldRemind = false;
        let timeLabel = "";

        if (appt.bot === 'consultation') {
            if (diffHours <= 3 && diffHours > 2 && !appt.reminded['3']) {
                shouldRemind = true; timeLabel = "3 hours"; appt.reminded['3'] = true;
            } else if (diffHours <= 2 && diffHours > 1 && !appt.reminded['2']) {
                shouldRemind = true; timeLabel = "2 hours"; appt.reminded['2'] = true;
            } else if (diffHours <= 1 && diffHours > 0 && !appt.reminded['1']) {
                shouldRemind = true; timeLabel = "1 hour"; appt.reminded['1'] = true;
            }
        } else {
            if (diffHours <= 10 && diffHours > 2 && !appt.reminded['10']) {
                shouldRemind = true; timeLabel = "10 hours"; appt.reminded['10'] = true;
            } else if (diffHours <= 2 && diffHours > 1 && !appt.reminded['2']) {
                shouldRemind = true; timeLabel = "2 hours"; appt.reminded['2'] = true;
            } else if (diffHours <= 1 && diffHours > 0 && !appt.reminded['1']) {
                shouldRemind = true; timeLabel = "1 hour"; appt.reminded['1'] = true;
            }
        }

        if (shouldRemind) {
            const isEn = appt.lang === 'EN';
            
            if (appt.bot === 'salon') {
                const reminderMsg = isEn 
                    ? `⏰ *Reminder:* Hello ${appt.clientName}, your appointment is scheduled in exactly *${timeLabel}*! We look forward to seeing you. ✨`
                    : `⏰ *Reminder:* Namaste ${appt.clientName}, aapki appointment theek *${timeLabel}* mein shuru hone wali hai! Kripya samay par pahuchein. ✨`;
                salonBot.sendMessage(appt.chatId, reminderMsg, { parse_mode: "Markdown" }).catch(()=>{});
            } else if (appt.bot === 'clinic') {
                const reminderMsg = isEn 
                    ? `⏰ *Reminder:* Hello ${appt.clientName}, your appointment is scheduled in exactly *${timeLabel}*! We look forward to seeing you. ✨`
                    : `⏰ *Reminder:* Namaste ${appt.clientName}, aapki appointment theek *${timeLabel}* mein shuru hone wali hai! Kripya samay par pahuchein. ✨`;
                zamZamBot.sendMessage(appt.chatId, reminderMsg, { parse_mode: "Markdown" }).catch(()=>{});
            } else if (appt.bot === 'consultation') {
                const consReminder = isEn 
                    ? `⏰ *Consultation Reminder:* Hello ${appt.clientName}, your strategy consultation call with Shahid Creatives' Team is starting in exactly *${timeLabel}*! Please be ready. 🚀\n\n🌐 _Powered by Shahid Creatives_`
                    : `⏰ *Consultation Reminder:* Namaste ${appt.clientName}, Shahid Creatives ki Team ke sath aapki strategy call theek *${timeLabel}* mein shuru hone wali hai! Kripya taiyar rahein. 🚀\n\n🌐 _Powered by Shahid Creatives_`;
                sendUnifiedMessage(appt.chatId, consReminder, appt.platform).catch(()=>{});
            }
        }
    });
}, 60000); 

const userSessions = {};

function calculateTotalPayable(basePrice, isUSD = false) {
    const cleanBase = parseFloat(basePrice.toString().replace(/[^0-9.]/g, ''));
    if (isNaN(cleanBase)) {
        return 0;
    }
    
    if (isUSD) {
        const totalUSD = cleanBase * 1.035;
        return Math.round(totalUSD);
    } else {
        const withGST = cleanBase * 1.18; 
        const totalPayable = withGST * 1.025; 
        return Math.round(totalPayable);
    }
}

function getBasePriceByPlan(planScope, isUSD = false) {
    const text = String(planScope).toLowerCase().trim();
    
    if (isUSD) {
        if (text.includes("starter ai suite (fb / ig)") || (text.includes("starter ai") && (text.includes("fb") || text.includes("ig")))) return "56";
        if (text.includes("growth ai suite (fb + ig dual)") || (text.includes("growth ai") && (text.includes("dual") || text.includes("fb + ig")))) return "112";
        if (text.includes("pro ai suite (multi-account & crm)") || text.includes("pro ai suite")) return "225";

        if (text.includes("whatsapp starter") || (text.includes("whatsapp") && text.includes("visiting card"))) return "22";
        if (text.includes("whatsapp growth") || (text.includes("whatsapp") && text.includes("booking"))) return "45";
        if (text.includes("whatsapp enterprise") || (text.includes("gemini") && text.includes("whatsapp"))) return "79";

        if (text.includes("starter complete (meta & whatsapp)") || text.includes("starter complete")) return "101";
        if (text.includes("growth complete (omnichannel engine)") || text.includes("growth complete")) return "180";
        if (text.includes("business pro complete (enterprise meta)") || text.includes("business pro complete")) return "338";

        if (text.includes("starter mobile mvp") || (text.includes("mobile") && text.includes("mvp")) || (text.includes("starter") && text.includes("mobile"))) return "399";
        if (text.includes("business pro") || text.includes("dual store") || (text.includes("mobile") && text.includes("business"))) return "799";
        if (text.includes("custom enterprise & scale") || text.includes("enterprise & scale") || (text.includes("mobile") && (text.includes("enterprise") || text.includes("scale")))) return "1499";

        if (text.includes("local ai & gmb growth") || text.includes("plan 1")) {
            if (text.includes("annual") || text.includes("year") || text.includes("399")) { return "399"; }
            return "69"; 
        }
        if (text.includes("full digital & ai scale launch") || text.includes("plan 2")) {
            if (text.includes("annual") || text.includes("year") || text.includes("799")) { return "799"; }
            return "169"; 
        }

        if (text.includes("starter digital") || text.includes("maintainer")) return "77";
        if (text.includes("web conversion") || text.includes("conversion engine")) return "155";
        if (text.includes("omnichannel") || text.includes("growth partner")) return "311";
        if (text.includes("ecosystem") || text.includes("full-scale")) return "499";
        if (text.includes("elite intelligence") || text.includes("bespoke systems")) return "799";
        if ((text.includes("telegram") && text.includes("starter"))) return "77";
        if ((text.includes("telegram") && text.includes("growth"))) return "155";
        if ((text.includes("telegram") && text.includes("elite"))) return "311";
        
        if (text.includes("starter plan") || text.includes("visiting card") || text.includes("starter / visiting card site")) return "199";
        if (text.includes("basic plan") || text.includes("landing page")) return "299";
        if (text.includes("starter business") || text.includes("business website")) return "499";
        if ((text.includes("e-commerce hub") || text.includes("ecommerce") || text.includes("e-commerce")) && !text.includes("sales automation") && !text.includes("retainer")) return "899";
        if (text.includes("custom enterprise") || text.includes("software")) return "2499";
        
        return "110";
    } else {
        if (text.includes("starter ai suite (fb / ig)") || (text.includes("starter ai") && (text.includes("fb") || text.includes("ig")))) return "3999";
        if (text.includes("growth ai suite (fb + ig dual)") || (text.includes("growth ai") && (text.includes("dual") || text.includes("fb + ig")))) return "7999";
        if (text.includes("pro ai suite (multi-account & crm)") || text.includes("pro ai suite")) return "15999";

        if (text.includes("whatsapp starter") || (text.includes("whatsapp") && text.includes("visiting card"))) return "1599";
        if (text.includes("whatsapp growth") || (text.includes("whatsapp") && text.includes("booking"))) return "3199";
        if (text.includes("whatsapp enterprise") || (text.includes("gemini") && text.includes("whatsapp"))) return "5599";

        if (text.includes("starter complete (meta & whatsapp)") || text.includes("starter complete")) return "7199";
        if (text.includes("growth complete (omnichannel engine)") || text.includes("growth complete")) return "12799";
        if (text.includes("business pro complete (enterprise meta)") || text.includes("business pro complete")) return "23999";

        if (text.includes("starter mobile mvp") || (text.includes("mobile") && text.includes("mvp")) || (text.includes("starter") && text.includes("mobile"))) return "24999";
        if (text.includes("business pro") || text.includes("dual store") || (text.includes("mobile") && text.includes("business"))) return "49500";
        if (text.includes("custom enterprise & scale") || text.includes("enterprise & scale") || (text.includes("mobile") && (text.includes("enterprise") || text.includes("scale")))) return "95000";

        if (text.includes("local ai & gmb growth") || text.includes("plan 1")) {
            if (text.includes("annual") || text.includes("year") || text.includes("24999")) { return "24999"; }
            return "4999"; 
        }
        if (text.includes("full digital & ai scale launch") || text.includes("plan 2")) {
            if (text.includes("annual") || text.includes("year") || text.includes("49999")) { return "49999"; }
            return "12999"; 
        }

        if (text.includes("starter digital") || text.includes("maintainer")) return "4999";
        if (text.includes("web conversion") || text.includes("conversion engine")) return "9499";
        if (text.includes("omnichannel") || text.includes("growth partner")) return "18999";
        if (text.includes("ecosystem") || text.includes("full-scale")) return "29999";
        if (text.includes("elite intelligence") || text.includes("bespoke systems")) return "49999";
        if ((text.includes("telegram") && text.includes("starter"))) return "3999";
        if ((text.includes("telegram") && text.includes("growth"))) return "7599";
        if ((text.includes("telegram") && text.includes("elite"))) return "15199";
        
        if (text.includes("landing page") || text.includes("funnel")) return "12300";
        if (text.includes("business") || text.includes("corporate")) return "25500";
        if ((text.includes("e-commerce") || text.includes("store")) && !text.includes("sales automation") && !text.includes("retainer")) return "47500";
        if (text.includes("saas") || text.includes("software") || text.includes("custom web application")) return "145000";
        
        return "8713"; 
    }
}

setInterval(() => {
    const now = Date.now();
    for (const from in userSessions) {
        const session = userSessions[from];
        if (session && session.step !== 'completed' && session.step !== 'post_registration' && session.step !== 'awaiting_custom_time_input' && (now - session.lastInteractionTime > 600000) && !session.nudgeSent) {
            const nudgeMessage = (session.lang === 'EN')
                ? "Hi! I noticed you were exploring our premium development options. Do you have any questions or need help locking in your slot? 😊"
                : "Hi! Maine dekha aap Shahid Creatives ki services explore kar rahe the. Kya aapko koi sawal hai ya coupon lock karne me koi help chahiye? 😊";
            
            session.step = 'nudge_sent_waiting_reply';
            sendUnifiedMessage(from, nudgeMessage, session.platform || 'whatsapp');
            session.nudgeSent = true; 
        }
    }
}, 60000);

app.get('/', (req, res) => {
    const VERIFY_TOKEN = "mysecrettoken";
    if (req.query['hub.mode'] && req.query['hub.verify_token']) {
        if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
            return res.status(200).send(req.query['hub.challenge']);
        } else {
            return res.sendStatus(403);
        }
    }
    res.status(200).send("Shahid Creatives Bot Server is Live on Render with Secured Credentials! 🚀 (Telegram & WhatsApp Both Active)");
});

app.post('/send-client-credentials', async (req, res) => {
    try {
        const payload = req.body;
        const tgChatId = payload.telegram_chat_id || payload.chat_id || "N/A";
        
        const adminAlertText = `🌟 *NEW API PORTAL LEAD!* 🌟\n\n👤 *Name:* ${payload.name || payload.client_name || "Unknown"}\n📱 *Phone:* ${payload.phone || payload.whatsapp_number || "0000"}\n💬 *Telegram Chat ID:* ${tgChatId}\n✉️ *Email:* ${payload.email || "Not Provided"}\n📝 *Plan Scope:* ${payload.plan || payload.project_scope || "N/A"}\n💰 *Calculated Price:* ${payload.price || payload.calculated_price || 0}`;
        sendAdminAlert(adminAlertText); 

        await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
            client_name: payload.name || payload.client_name || "API Inbound Portal Lead",
            whatsapp_number: payload.phone || payload.whatsapp_number || "0000000000",
            telegram_chat_id: tgChatId,
            project_scope: payload.plan || payload.project_scope || "Credentials Sync Event",
            calculated_price: payload.price || payload.calculated_price || 0,
            coupon_code: "11VI20",
            email: payload.email || "Not Provided",
            discussion_notes: adminAlertText 
        });
        res.status(200).json({ success: true, message: "Credentials Packet routed securely!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/send-payment-reminder', async (req, res) => {
    try {
        const payload = req.body;
        const clientPhone = payload.phone || payload.whatsapp_number;
        const isUSD = payload.currency === 'USD' || payload.is_usd === true;
        
        if (!clientPhone) {
            return res.status(400).json({ success: false, error: "Missing number" });
        }

        const reminderMessage = isUSD
            ? `⚠️ *Payment Pending Reminder - Shahid Creatives* 🚀\n\nHello,\n\nThis is a quick reminder regarding your slot confirmation. Please complete your token payment ($49 USD) using your secure dashboard link to avoid slot cancellation. 👍\n\n🌐 _Powered by Shahid Creatives_`
            : `⚠️ *Payment Pending Reminder - Shahid Creatives* 🚀\n\nHello,\n\nThis is a quick reminder regarding your slot confirmation. Kripya apna pending token payment (₹999 INR) secure link se poora karein taki aapka slot cancel na ho. 👍\n\n🌐 _Powered by Shahid Creatives_`;

        await sendWhatsAppMessage(clientPhone, reminderMessage);
        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "mysecrettoken";
    if (req.query['hub.mode'] && req.query['hub.verify_token']) {
        if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
            return res.status(200).send(req.query['hub.challenge']);
        } else {
            return res.sendStatus(403);
        }
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
                    console.log(`Received message from ${from}: ${rawText}`);
                    
                    if (processingLocks[from]) return;
                    processingLocks[from] = true;
                    try {
                        await processUnifiedMessage(from, rawText, 'whatsapp');
                    } finally {
                        delete processingLocks[from];
                    }
                }                   
            }
        } catch (error) { 
            console.error("Webhook processing logic error.", error.message); 
        }
    }
}); 

async function processUnifiedMessage(from, rawText, platform) {
    const userText = rawText.trim().toLowerCase();
    const cleanNormalized = userText.replace(/[^a-z0-9]/g, '');
    
    const isInternationalNumber = platform === 'whatsapp' ? !from.startsWith("91") : false;
    const isGlobalWebsiteTemplate = rawText.includes("Global USD") || rawText.includes("Worldwide") || rawText.includes("$") || rawText.includes("lock in my custom website estimate");

    const isConsultationOrPlanTrigger = 
        userText.includes("book demo") || 
        userText.includes("book consultation") || 
        userText.includes("interested in") || 
        userText.includes("i am interested in");

    if (isConsultationOrPlanTrigger) {
        let extractedPlan = "Complete Plan / Consultation";
        const interestMatch = rawText.match(/interested in\s*([^\.\n]+)/i);
        if (interestMatch) {
            extractedPlan = interestMatch[1].trim();
        }

        const isExplicitUSD = rawText.includes('USD') || rawText.includes('$');
        const isExplicitINR = rawText.includes('INR') || rawText.includes('₹') || rawText.toLowerCase().includes('punjab') || rawText.toLowerCase().includes('india');
        const isUSDTrack = isExplicitUSD ? true : (isExplicitINR ? false : isInternationalNumber);

        userSessions[from] = {
            step: 'awaiting_consultation_slot',
            lang: isUSDTrack ? 'EN' : 'HINGLISH',
            platform: platform,
            clientName: "Valued Client",
            clientEmail: "Not Provided",
            clientPhone: platform === 'whatsapp' ? from : "",
            projectScope: extractedPlan,
            savedPlan: extractedPlan,
            lastInteractionTime: Date.now(),
            nudgeSent: false,
            skipIdentityCapture: false
        };

        const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();

        const optionA = (currentHourIST >= 17) ? "🅰️ *Kal Shaam 5:00 Baje*" : "🅰️ *Aaj Shaam 5:00 Baje*";
        const optionB = (currentHourIST >= 17) ? "🅱️ *Parso Dopahar 12:00 Baje*" : "🅱️ *Kal Dopahar 12:00 Baje*";
        const optionA_EN = (currentHourIST >= 17) ? "🅰️ *Tomorrow at 5:00 PM*" : "🅰️ *Today at 5:00 PM*";
        const optionB_EN = (currentHourIST >= 17) ? "🅱️ *Day After Tomorrow at 12:00 PM*" : "🅱️ *Tomorrow at 12:00 PM*";

        const replyMsg = isUSDTrack
            ? `Hello! We received your request for *${extractedPlan}*.\n\n👤 *Direct Consultation Setup:*\n\n${optionA_EN}\n${optionB_EN}\n🅲️ *Custom Time (Type preferred time below)*\n\n👉 Reply with A, B, or C to secure your slot & choose your complete plan!`
            : `Hello! Humne aapki request (*${extractedPlan}*) receive kar li hai.\n\n👤 *Direct Consultation Setup:*\n\n${optionA}\n${optionB}\n🅲️ *Custom Time (Apna secure timing niche type karein)*\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye apna slot secure karne aur complete plan choose karne ke liye!`;

        return sendUnifiedMessage(from, replyMsg, platform);
    }

    const isWebsiteDemoInbound = 
        cleanNormalized.includes("3dayfreevipdemo") ||
        cleanNormalized.includes("queuedforactivation") ||
        cleanNormalized.includes("includedingrowthtriad") ||
        cleanNormalized.includes("demoiddemo") ||
        cleanNormalized.includes("activationtimeline") ||
        (cleanNormalized.includes("demoid") && cleanNormalized.includes("clientcontact")) ||
        (cleanNormalized.includes("congratulations") && cleanNormalized.includes("vipdemo")) ||
        cleanNormalized.includes("registrationdetails") ||
        rawText.includes("DEMO-39516") ||
        rawText.includes("DEMO-38661") ||
        rawText.includes("SHAHID ENTERPRISES") ||
        rawText.includes("SHAHID CREATIVES");

    if (isWebsiteDemoInbound) {
        let clientName = "Valued Client";
        let demoId = `DEMO-${Math.floor(10000 + Math.random() * 90000)}`;
        let clientPhone = platform === 'whatsapp' ? from : "";
        let clientEmail = "Not Provided";
        let bizName = "Valued Business";

        try {
            const idMatch = rawText.match(/(?:Demo ID|Activation ID|ID)[^:\n]*:\s*`?([A-Za-z0-9-]+)`?/i);
            if (idMatch) demoId = idMatch[1].replace(/[*_`]/g, '').trim();

            const nameMatch = rawText.match(/(?:Client\s*\/\s*Contact|Contact Person Name|Name)[^:\n]*:\s*([^\n\r]+)/i);
            if (nameMatch) {
                clientName = nameMatch[1].replace(/[*_`]/g, '').trim();
            } else {
                const altNameMatch = rawText.match(/Congratulations\s+([A-Za-z\s]+)!/i);
                if (altNameMatch) clientName = altNameMatch[1].replace(/[*_`]/g, '').trim();
            }

            const bizMatch = rawText.match(/(?:VIP Demo for|Business or Brand Name|Business|Brand)[^:\n]*[:\s]+([^\n\r.]+)/i);
            if (bizMatch) bizName = bizMatch[1].replace(/[*_`]/g, '').trim();

            const phoneMatch = rawText.match(/(?:Phone\s*\/\s*WhatsApp|WhatsApp\s*\/\s*Phone Number|Phone|Mobile)[^:\n]*:\s*([^\n\r]+)/i);
            if (phoneMatch) clientPhone = phoneMatch[1].replace(/[*_`📞+]/g, '').trim();

            const emailMatch = rawText.match(/(?:Email|Email Address)[^:\n]*:\s*([^\n\r]+)/i);
            if (emailMatch) clientEmail = emailMatch[1].replace(/[*_`✉️]/g, '').trim();
        } catch (e) {}

        const isEnglishUser = isInternationalNumber || isGlobalWebsiteTemplate;

        userSessions[from] = {
            step: 'completed',
            lang: isEnglishUser ? 'EN' : 'HINGLISH',
            platform: platform,
            clientName: clientName,
            clientEmail: clientEmail,
            clientPhone: clientPhone,
            projectScope: `VIP Demo Activation (${demoId})`,
            lastInteractionTime: Date.now(),
            lastSubmitedTime: Date.now(),
            nudgeSent: true,
            skipIdentityCapture: true
        };

        const replyMsgEN = `👋 Hello *${clientName}*, thank you for choosing *Shahid Creatives*! 🚀\n\nWe have successfully received all your details for the *3-Day Free VIP Demo* (ID: \`${demoId}\`).\n\n⏱️ *Activation Timeline:* *Minimum 5 Hours to Maximum 1 Working Day*\nOur engineering team is already configuring your dedicated AI node, Google Business sync, and verified bot setup. Your service will be activated shortly within this timeframe.\n\n📞 *Next Step:* Our team from *Shahid Creatives* will connect with you directly here for confirmation and activation as soon as it goes live! You don't need to take any further action. ✨\n\n🌐 _Powered by Shahid Creatives (https://shahidcreatives.com)_`;

        const replyMsgHIN = `👋 Namaste *${clientName}*, *Shahid Creatives* mein aapka swagat hai! 🚀\n\nWebsite se aapka *3-Day Free VIP Demo* submission (ID: \`${demoId}\`) humein successfully receive ho gaya hai.\n\n⏱️ *Activation Timeline:* *Minimum 5 Hours se lekar Maximum 1 Working Day*\nAapki service diye gaye samay ke andar activate kar di jayegi. Humari technical team aapka dedicated node, Google Business sync aur verified bot setup configure kar rahi hai.\n\n📞 *Next Step:* *Shahid Creatives* ki team confirmation aur activation ke liye aapse bohot jald isi chat par connect karegi! Aapko abhi koi appointment book karne ya detail bhejne ki zaroorat nahi hai. ✨\n\n🌐 _Powered by Shahid Creatives_`;

        const finalMsg = isEnglishUser ? replyMsgEN : replyMsgHIN;

        const adminAlertMsg = `🚨 *NEW WEBSITE DEMO INBOUND LEAD!* 🚨\n\n👤 *Client:* ${clientName}\n🏢 *Brand:* ${bizName}\n🆔 *Demo ID:* ${demoId}\n📱 *Phone:* ${clientPhone}\n✉️ *Email:* ${clientEmail}\n💬 *Platform:* ${platform}\n\n*Action:* System queued with 5hr-1day window. Bot parked safely to completed state.`;
        sendAdminAlert(adminAlertMsg);

        axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
            client_name: clientName, 
            whatsapp_number: clientPhone || from, 
            telegram_chat_id: platform === 'telegram' ? from : undefined, 
            project_scope: `3-Day Free VIP Demo (${demoId})`, 
            calculated_price: 0, 
            coupon_code: "11VI20",
            email: clientEmail, 
            discussion_notes: adminAlertMsg 
        }).catch(()=>{});

        return sendUnifiedMessage(from, finalMsg, platform);
    }

    if (
        userText.includes("successfully authorized and connected") || 
        userText.includes("i have successfully authorized") ||
        userText.includes("authorized and connected google business profile") || 
        userText.includes("confirm our 24/7 ai review bot status")
    ) {
        let demoIdMatch = rawText.match(/(?:DEMO|SC-EID)-?\s*([A-Za-z0-9]+)/i);
        let extDemoId = demoIdMatch ? demoIdMatch[0].replace(/\s+/g, '') : "your Demo";

        const isEnglishUser = isInternationalNumber || isGlobalWebsiteTemplate;

        userSessions[from] = {
            step: 'completed',
            lang: isEnglishUser ? 'EN' : 'HINGLISH',
            platform: platform,
            clientName: "Valued Client",
            projectScope: `GBP Verification & Setup (${extDemoId})`,
            lastInteractionTime: Date.now(),
            lastSubmitedTime: Date.now(),
            nudgeSent: true
        };

        const authReply = isEnglishUser
            ? `🙏 *Thank you for connecting with Shahid Creatives!* ✨\n\nWe have successfully received your Google Business Profile authorization request for *${extDemoId}*.\n\n⚙️ *Activation Status:* In Progress\n⏱️ *Estimated Activation Timeline:* Minimum *5 hours* to Maximum *1 working day*.\n\nOur engineering team is currently configuring your dedicated 24/7 AI review responder, Meta-Verified WhatsApp integration, and hyper-local SEO systems. We will notify you here as soon as your setup goes live!\n\n🌐 _Powered by Shahid Creatives (https://shahidcreatives.com)_`
            : `🙏 *Shahid Creatives me sampark karne ke liye dhanyawad!* ✨\n\n*${extDemoId}* ke liye aapka Google Business Profile authorization request humein successfully receive ho gaya hai.\n\n⚙️ *Activation Status:* In Progress\n⏱️ *Estimated Activation Time:* Minimum *5 hours* se lekar Maximum *1 working day*.\n\nHumari technical team aapke 24/7 AI Review Bot, Meta-Verified WhatsApp setup, aur Hyper-Local SEO system ko configure kar rahi hai. Setup live hote hi hum aapko is number par turant update de denge!\n\n🌐 _Powered by Shahid Creatives (https://shahidcreatives.com)_`;

        const adminAlertMsg = `🌟 *GBP AUTHORIZATION RECEIVED!* 🌟\n\n📱 *Client Contact:* ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Platform:* ${platform}\n🆔 *Demo ID:* ${extDemoId}\n\nClient has verified the profile authorization. Activation timeline (Minimum 5 hours to Maximum 1 working day) conveyed.`;
        sendAdminAlert(adminAlertMsg);

        try {
            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', {
                client_name: `GBP Demo Client (${extDemoId})`,
                whatsapp_number: from,
                telegram_chat_id: platform === 'telegram' ? from : undefined,
                project_scope: `GBP Connection Authorized (${extDemoId})`,
                calculated_price: 0,
                coupon_code: "11VI20",
                email: "Not Provided",
                discussion_notes: adminAlertMsg
            });
        } catch (e) {}

        return sendUnifiedMessage(from, authReply, platform);
    }

    if (
        rawText.includes("3-DAY FREE DEMO ACTIVATION") ||
        rawText.includes("11VI SHARIF SPECIAL") ||
        rawText.includes("Please initiate setup handshake") ||
        (rawText.includes("Activation ID:") && rawText.includes("Phone:")) ||
        (rawText.includes("Contact Person Name:") && rawText.includes("Business or Brand Name:"))
    ) {
        let clientName = "Valued Business";
        let bizName = "Valued Business";
        let clientPhone = platform === 'whatsapp' ? from : "";
        let clientEmail = "Not Provided";
        let city = "Ludhiana";
        let category = "General";
        let activationId = `DEMO-${Math.floor(10000 + Math.random() * 90000)}`;

        try {
            const idMatch = rawText.match(/(?:Activation ID|Demo ID|ID)[^:]*:\s*([^\n\r]+)/i);
            const bizMatch = rawText.match(/(?:Business|Business or Brand Name|Brand)[^:]*:\s*([^\n\r]+)/i);
            const contactMatch = rawText.match(/(?:Contact|Contact Person Name|Name)[^:]*:\s*([^\n\r]+)/i);
            const phoneMatch = rawText.match(/(?:Phone|WhatsApp \/ Phone Number|Mobile)[^:]*:\s*([^\n\r]+)/i);
            const emailMatch = rawText.match(/(?:Email|Email Address)[^:]*:\s*([^\n\r]+)/i);
            const cityMatch = rawText.match(/(?:City|Target City \/ Location|Location)[^:]*:\s*([^\n\r]+)/i);
            const catMatch = rawText.match(/(?:Category|Business Category)[^:]*:\s*([^\n\r]+)/i);

            if (idMatch) activationId = idMatch[1].replace(/[*_]/g, '').trim();
            if (bizMatch) bizName = bizMatch[1].replace(/[*_]/g, '').trim();
            if (contactMatch) clientName = contactMatch[1].replace(/[*_]/g, '').trim();
            else clientName = bizName;
            if (phoneMatch) clientPhone = phoneMatch[1].replace(/[*_📞]/g, '').trim();
            if (emailMatch) clientEmail = emailMatch[1].replace(/[*_✉️]/g, '').trim();
            if (cityMatch) city = cityMatch[1].replace(/[*_📍]/g, '').trim();
            if (catMatch) category = catMatch[1].replace(/[*_🏷️]/g, '').trim();
        } catch (e) {}

        const isEnglishUser = isInternationalNumber || isGlobalWebsiteTemplate;

        userSessions[from] = {
            step: 'completed',
            lang: isEnglishUser ? 'EN' : 'HINGLISH',
            platform: platform,
            clientName: clientName,
            clientEmail: clientEmail,
            clientPhone: clientPhone,
            projectScope: `3-Day Free VIP Demo (${bizName})`,
            lastInteractionTime: Date.now(),
            lastSubmitedTime: Date.now(),
            nudgeSent: true,
            skipIdentityCapture: true
        };

        const onboardingLink = `https://api.shahidcreatives.com/connect-gmb?clientId=${encodeURIComponent(activationId)}`;
        const waText = encodeURIComponent(`Hello Shahid! I have successfully authorized and connected Google Business Profile for: ${activationId} (ID: ${activationId}). Please confirm our 24/7 AI review bot status!`);
        const waKickoffLink = `https://wa.me/917529839762?text=${waText}`;

        if (clientEmail && clientEmail !== "Not Provided" && clientEmail.includes("@")) {
            const mailOptions = {
                from: '"Shahid Creatives AI" <contact@shahidcreatives.com>',
                to: clientEmail,
                subject: `🎉 Action Required: Your 3-Day Free VIP Demo & GBP Onboarding [${activationId}]`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #0056b3;">Thank you & Congratulations, ${bizName}! 🚀</h2>
                        <p>Your <strong>3-Day Free VIP Demo</strong> for <strong>${bizName}</strong> has been successfully registered and queued for activation!</p>
                        <p><strong>Activation ID:</strong> <span style="background: #eee; padding: 5px 10px; border-radius: 5px; font-weight: bold;">${activationId}</span></p>
                        <p>⏱️ <strong>Activation Timeline:</strong> Minimum 5 Hours to Maximum 1 Working Day.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <h3 style="color: #d9534f;">⚠️ Important Instruction: GBP Connection</h3>
                        <p>To enable the AI review responder and Maps ranking sync, please connect your Google Business Profile below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${onboardingLink}" style="background-color: #28a745; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">🔗 Connect Google Business Profile (GBP)</a>
                        </div>
                        <p>Please ensure you authorize ONLY with the Gmail/Google Account that is officially registered to your Google Business Profile.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p><a href="${waKickoffLink}">🚀 Connect with Shahid on WhatsApp (Instant Kickoff)</a></p>
                        <p><br>Best Regards,<br><strong>Shahid Creatives AI Team</strong></p>
                    </div>
                `
            };
            transporter.sendMail(mailOptions).catch(err => console.log("Demo Mail Error:", err));
        }

        const replyConfirmation = `🎉 *Thank you & Congratulations ${clientName}!* 🚀\n\nYour *3-Day Free VIP Demo* for *${bizName}* has been successfully registered and queued for activation!\n\n🆔 *Demo ID:* \`${activationId}\`\n👤 *Client / Contact:* ${clientName}\n📱 *Phone / WhatsApp:* ${clientPhone.startsWith('+') ? clientPhone : '+' + clientPhone}\n✉️ *Email:* ${clientEmail}\n📍 *Location:* ${city}\n🏷️ *Category:* ${category}\n\n⚡ *Included in Growth Triad:*\n1️⃣ Google Business Profile (GMB) AI Engine (Auto 5-star review replies)\n2️⃣ Hyper-Local SEO Audit Simulator (Competitor keyword ranking gaps)\n3️⃣ 24/7 Telegram & Meta-Verified WhatsApp Business API Bot (Official verified integration)\n\n✅ *Official Meta Business Verified | Zero Risk Guarantee*\n⏱️ *Activation Timeline:* *Minimum 5 Hours to Maximum 1 Working Day*\n_(Our technical team is configuring your dedicated node, knowledgebase, and verified GBP sync.)_\n\n🔗 *GBP AI Onboarding Link:*\n${onboardingLink}\n\n⚠️ *Zaroori Instruction:* Kripya GBP onboarding link ko apne *Google Business Profile (GBP) registered Google/Gmail account* se hi open/authorize karein.\n\n👉 *Direct Demo Portal:* https://shahidcreatives.com/#combo-demo\n\n- Shahid Creatives (https://shahidcreatives.com)`;

        const adminAlertMsg = `🚨 *11VI SHARIF SPECIAL / 3-DAY DEMO INBOUND LEAD!* 🚨\n\n📱 *Contact:* ${clientPhone} (${platform})\n💬 *Chat ID:* ${from}\n👤 *Contact:* ${clientName}\n🏢 *Business:* ${bizName}\n🆔 *Demo ID:* ${activationId}\n📍 *Location:* ${city}\n🏷️ *Category:* ${category}\n\n*Action:* Demo queued with 5hr-1day activation window.`;
        sendAdminAlert(adminAlertMsg);

        try {
            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                client_name: clientName, 
                whatsapp_number: clientPhone || from, 
                telegram_chat_id: platform === 'telegram' ? from : undefined, 
                project_scope: `3-Day Free VIP Demo (${bizName})`, 
                calculated_price: 0, 
                coupon_code: "11VI20",
                email: clientEmail, 
                discussion_notes: adminAlertMsg 
            });
        } catch (e) {}

        const tgOptions = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔗 Connect Google Business Profile (GBP)", url: onboardingLink }],
                    [{ text: "🚀 Notify Authorization (Send to Team)", url: waKickoffLink }]
                ]
            }
        };

        return sendUnifiedMessage(from, replyConfirmation, platform, tgOptions);
    }

    const resetTriggers = [
        'hi', 'hello', 'menu', 'start', '/start', 'hey',
        'hi shahid', 'hello shahid',
        'inquire about your services',
        'i want to inquire about your services',
        'want to inquire about your services',
        'services', 'service', 'inquiry'
    ];

    const isMatchReset = resetTriggers.some(t => userText === t || (userText.startsWith('hi') && userText.includes('inquire')) || (userText.includes('inquire') && userText.includes('service')));

    if (isMatchReset) {
        const existingSession = userSessions[from];
        const recentlyCompleted = existingSession &&
            existingSession.step === 'completed' &&
            existingSession.lastSubmitedTime &&
            (Date.now() - existingSession.lastSubmitedTime < 10 * 60 * 1000);

        if (recentlyCompleted) {
            let alreadyMsg = (existingSession.lang === 'EN')
                ? `Hi *${existingSession.clientName}*! Your request (*${existingSession.projectScope}*) is already registered. Our team will connect with you shortly for confirmation and activation! (Timeline: *Minimum 5 Hours to Maximum 1 Working Day*). 🚀\n\n🌐 _Powered by Shahid Creatives_`
                : `Hi *${existingSession.clientName}*! Aapki request (*${existingSession.projectScope}*) already register ho chuki hai. Humari team confirmation aur activation ke liye aapse bohot jald connect karegi! (Timeline: *Minimum 5 Hours se Maximum 1 Working Day*). 🚀\n\n🌐 _Powered by Shahid Creatives_`;
            return sendUnifiedMessage(from, alreadyMsg, platform);
        }

        userSessions[from] = null;
    }

    if (!userSessions[from]) {
        userSessions[from] = { 
            step: 'region_check', 
            lang: (isInternationalNumber || isGlobalWebsiteTemplate) ? 'EN' : 'HINGLISH', 
            platform: platform, 
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
    const session = userSessions[from]; 

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
        
        const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${projectID}&amount=${tokenAmount}&currency=${tokenCurrency}&totalPrice=${finalPayable}&name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail)}&phone=${from}&plan=${encodeURIComponent(projectScope)}&coupon=11VI20`;

        userSessions[from] = { 
            step: 'payment_failed_resolution',
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

        const currencyAdmin = isUSDTrack ? '$' : '₹';
        const alertMsg = `🚨 *URGENT: PAYMENT DROP-OFF REPORTED!* 🚨\n\n📱 *Client:* ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${clientName}\n📝 *Plan Scope:* ${projectScope}\n🆔 *Client ID:* ${projectID}\n💵 *Base Price:* ${currencyAdmin}${matchedBasePrice}\n🔥 *Discount Applied:* ${currencyAdmin}${savingAmount} (11VI20)\n💰 *Calculated Price:* ${currencyAdmin}${finalPayable}\n\n⚠️ *Action:* Client bot interaction active to check debit/cancel status.`;
        sendAdminAlert(alertMsg);

        let replyMsg = isINRLead
            ? `Oh no! 😟 Maafi chahte hain *${clientName}*, lagta hai aapka *${projectScope}* ka transaction technical issue ki wajah se ruk gaya hai.\n\nKripya batayein ki aapke account ka status kya hai? Niche diye gaye options mein se ek (1 ya 2) chunein:\n\n1️⃣ **Payment account se kat gaya hai (Amount Debited)**\n2️⃣ **Payment fail ya cancel ho gaya tha (Failed/Cancelled)**`
            : `Oh no! 😟 I'm sorry to hear that your transaction for the *${projectScope}* encountered an issue, *${clientName}*.\n\nCould you please confirm your account status? Reply with 1 or 2:\n\n1️⃣ **The amount was debited from my account**\n2️⃣ **The payment failed or was cancelled**`;
            
        return sendUnifiedMessage(from, replyMsg, platform);
    }

    if (rawText.includes("Name:") && rawText.includes("Phone:") && rawText.includes("Email:") && !rawText.includes("Target City")) {
        let clientName = "Valued Client";
        let clientEmail = "Not Provided";
        let clientPhone = platform === 'whatsapp' ? from : "";
        let projectScope = "Consultation Inquiry";
        
        try {
            const nameMatch = rawText.match(/Name:\s*([^\n\r]+)/i);
            const phoneMatch = rawText.match(/Phone:\s*([^\n\r]+)/i);
            const emailMatch = rawText.match(/Email:\s*([^\n\r]+)/i);
            const interestMatch = rawText.match(/interested in\s*([^\.\n]+)/i);

            if (nameMatch) clientName = nameMatch[1].replace(/[*_📌]/g, '').trim();
            if (phoneMatch) clientPhone = phoneMatch[1].replace(/[*_📞]/g, '').trim();
            if (emailMatch) clientEmail = emailMatch[1].replace(/[*_✉️]/g, '').trim();
            if (interestMatch) projectScope = interestMatch[1].trim();
        } catch (e) {}

        const isExplicitUSD = rawText.includes('USD') || rawText.includes('$');
        const isExplicitINR = rawText.includes('INR') || rawText.includes('₹') || rawText.toLowerCase().includes('punjab') || rawText.toLowerCase().includes('india');
        const isUSDTrack = isExplicitUSD ? true : (isExplicitINR ? false : isInternationalNumber);

        userSessions[from] = {
            step: 'awaiting_consultation_slot',
            lang: isUSDTrack ? 'EN' : 'HINGLISH',
            platform: platform,
            clientName: clientName,
            clientEmail: clientEmail,
            clientPhone: clientPhone, 
            projectScope: projectScope,
            savedPlan: projectScope,
            lastInteractionTime: Date.now(),
            nudgeSent: false,
            skipIdentityCapture: true 
        };

        const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
        
        const optionA = (currentHourIST >= 17) ? "A) *Kal Shaam 5:00 Baje*" : "A) *Aaj Shaam 5:00 Baje*";
        const optionB = (currentHourIST >= 17) ? "B) *Parso Dopahar 12:00 Baje*" : "B) *Kal Dopahar 12:00 Baje*";
        const optionA_EN = (currentHourIST >= 17) ? "A) *Tomorrow at 5:00 PM*" : "A) *Today at 5:00 PM*";
        const optionB_EN = (currentHourIST >= 17) ? "B) *Day After Tomorrow at 12:00 PM*" : "B) *Tomorrow at 12:00 PM*";

        const replyMsg = isUSDTrack 
            ? `Hello *${clientName}*! We received your details for *${projectScope}*.\n\n👤 *Direct Consultation Setup:*\n\n${optionA_EN}\n${optionB_EN}\n🅲️ *Custom Time (Type preferred time below)*\n\n👉 Reply with A, B, or C!`
            : `Hello *${clientName}*! Humne aapki details save kar li hain (*${projectScope}*).\n\n👤 *Direct Consultation Setup:*\n\n${optionA}\n${optionB}\n🅲️ *Custom Time (Apna secure timing niche type karein)*\n\n👉 Kripya **A, B, ya C** likh kar reply kijiye!`;

        return sendUnifiedMessage(from, replyMsg, platform);
    }

    if (currentStep === 'demo_activation_submit') {
        if (rawText.length < 25 || (!rawText.toLowerCase().includes('name') && !rawText.toLowerCase().includes('business'))) {
            let errMsg = (userLang === 'EN')
                ? "⚠️ *Incomplete Details!*\nPlease copy the full form template provided above, fill in your business details, and reply to activate your demo."
                : "⚠️ *Incomplete Details!*\nKripya upar diye gaye form template ko pura copy karein, apni business details bharein, aur fir reply karke apna demo activate karein.";
            return sendUnifiedMessage(from, errMsg, platform);
        }

        userSessions[from].step = 'completed';
        
        let clientName = "Demo Client";
        let clientEmail = "Not Provided";
        let displayPhone = platform === 'whatsapp' ? from : "Not Provided";
        let bizName = "Valued Business";
        let city = "Ludhiana";
        let category = "General";

        try {
            const nameMatch = rawText.match(/Contact Person Name:\s*([^\n\r]+)/i);
            const emailMatch = rawText.match(/Email Address \(Optional\):\s*([^\n\r]+)/i);
            const phoneMatch = rawText.match(/WhatsApp \/ Phone Number:\s*([^\n\r]+)/i);
            
            const bizNameMatch = rawText.match(/Business or Brand Name:\s*([^\n\r]+)/i);
            const locMatch = rawText.match(/Target City \/ Location:\s*([^\n\r]+)/i);
            const catMatch = rawText.match(/Business Category:\s*([^\n\r]+)/i);
            
            if (nameMatch) clientName = nameMatch[1].replace(/[*_]/g, '').trim();
            if (emailMatch) clientEmail = emailMatch[1].replace(/[*_]/g, '').trim();
            if (phoneMatch) displayPhone = phoneMatch[1].replace(/[*_]/g, '').trim();
            
            if (bizNameMatch) bizName = bizNameMatch[1].replace(/[*_]/g, '').trim();
            if (locMatch) city = locMatch[1].replace(/[*_]/g, '').trim();
            if (catMatch) category = catMatch[1].replace(/[*_]/g, '').trim();
        } catch (e) {}

        const demoId = `DEMO-${Math.floor(10000 + Math.random() * 90000)}`;
        const onboardingLink = `https://api.shahidcreatives.com/connect-gmb?clientId=${demoId}`;
        const waText = encodeURIComponent(`Hello Shahid! I have successfully authorized and connected Google Business Profile for: ${demoId} (ID: ${demoId}). Please confirm our 24/7 AI review bot status!`);
        const waKickoffLink = `https://wa.me/917529839762?text=${waText}`;

        const adminAlert = `🚨 *NEW 3-DAY DEMO ACTIVATION!* 🚨\n\n📱 *Contact:* ${displayPhone} (${platform})\n💬 *Chat ID:* ${from}\n👤 *Extracted Name:* ${clientName}\n🏢 *Business:* ${bizName}\n🆔 *Demo ID:* ${demoId}\n📍 *City:* ${city}\n🏷️ *Category:* ${category}\n\n*📋 Submitted Form Data:*\n${rawText}`;
        sendAdminAlert(adminAlert);

        try {
            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                client_name: clientName, 
                whatsapp_number: displayPhone, 
                telegram_chat_id: platform === 'telegram' ? from : undefined, 
                project_scope: `3-Day Free VIP Demo Request (${bizName})`, 
                calculated_price: 0, 
                coupon_code: "11VI20",
                email: clientEmail, 
                discussion_notes: adminAlert 
            });
        } catch (e) { }

        if (clientEmail && clientEmail !== "Not Provided" && clientEmail.includes("@")) {
            const mailOptions = {
                from: '"Shahid Creatives AI" <contact@shahidcreatives.com>',
                to: clientEmail,
                subject: `🎉 Action Required: Your 3-Day Free VIP Demo & GBP Onboarding [${demoId}]`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                        <h2 style="color: #0056b3;">Thank you & Congratulations, ${bizName}! 🚀</h2>
                        <p>Your <strong>3-Day Free VIP Demo</strong> for <strong>${bizName}</strong> has been successfully registered and queued for activation!</p>
                        <p><strong>Your Unique Demo ID:</strong> <span style="background: #eee; padding: 5px 10px; border-radius: 5px; font-weight: bold;">${demoId}</span></p>
                        <p>⏱️ <strong>Activation Timeline:</strong> Minimum 5 Hours to Maximum 1 Working Day.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <h3 style="color: #d9534f;">⚠️ Important Instruction: GBP Connection</h3>
                        <p>To enable the AI review responder and Maps ranking sync, please connect your Google Business Profile below:</p>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${onboardingLink}" style="background-color: #28a745; color: white; padding: 15px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">🔗 Connect Google Business Profile (GBP)</a>
                        </div>
                        <p>Please ensure you authorize ONLY with the Gmail/Google Account that is officially registered to your Google Business Profile.</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p><a href="${waKickoffLink}">🚀 Connect with Shahid on WhatsApp (Instant Kickoff)</a></p>
                        <p><br>Best Regards,<br><strong>Shahid Creatives AI Team</strong></p>
                    </div>
                `
            };
            transporter.sendMail(mailOptions).catch(err => console.log("Demo Mail Error:", err));
        }

        const successMsgEN = `🎉 *Thank you & Congratulations ${bizName}!* 🚀\n\nYour *3-Day Free VIP Demo* for *${bizName}* has been successfully registered and queued for activation!\n\n🆔 *Demo ID:* \`${demoId}\`\n👤 *Client / Contact:* ${clientName}\n📱 *Phone / WhatsApp:* ${displayPhone.startsWith('+') ? displayPhone : '+' + displayPhone}\n✉️ *Email:* ${clientEmail}\n📍 *Location:* ${city}\n🏷️ *Category:* ${category}\n\n⚡ *Included in Growth Triad:*\n1️⃣ Google Business Profile (GMB) AI Engine (Auto 5-star review replies)\n2️⃣ Hyper-Local SEO Audit Simulator (Competitor keyword ranking gaps)\n3️⃣ 24/7 Telegram & Meta-Verified WhatsApp Business API Bot (Official verified integration)\n\n✅ *Official Meta Business Verified | Zero Risk Guarantee*\n⏱️ *Activation Timeline:* *Minimum 5 Hours to Maximum 1 Working Day*\n_(Our technical team is configuring your dedicated node, knowledgebase, and verified GBP sync.)_\n\n🔗 *GBP AI Onboarding Link:*\n${onboardingLink}\n\n⚠️ *Zaroori Instruction:* Kripya GBP onboarding link ko apne *Google Business Profile (GBP) registered Google/Gmail account* se hi open/authorize karein.\n\n👉 *Direct Demo Portal:* https://shahidcreatives.com/#combo-demo\n\n- Shahid Creatives (https://shahidcreatives.com)`;

        const successMsgHIN = `🎉 *Thank you & Congratulations ${bizName}!* 🚀\n\nAapka *3-Day Free VIP Demo* (*${bizName}* ke liye) successfully registered aur activation queue me save ho gaya hai!\n\n🆔 *Demo ID:* \`${demoId}\`\n👤 *Client / Contact:* ${clientName}\n📱 *Phone / WhatsApp:* ${displayPhone.startsWith('+') ? displayPhone : '+' + displayPhone}\n✉️ *Email:* ${clientEmail}\n📍 *Location:* ${city}\n🏷️ *Category:* ${category}\n\n⚡ *Included in Growth Triad:*\n1️⃣ Google Business Profile (GMB) AI Engine (Auto 5-star review replies)\n2️⃣ Hyper-Local SEO Audit Simulator (Competitor keyword ranking gaps)\n3️⃣ 24/7 Telegram & Meta-Verified WhatsApp Business API Bot (Official verified integration)\n\n✅ *Official Meta Business Verified | Zero Risk Guarantee*\n⏱️ *Activation Timeline:* *Minimum 5 Hours se lekar Maximum 1 Working Day*\n_(Humari technical team aapka dedicated node, knowledgebase aur verified GBP sync configure kar rahi hai.)_\n\n🔗 *GBP AI Onboarding Link:*\n${onboardingLink}\n\n⚠️ *Zaroori Instruction:* Kripya GBP onboarding link ko apne *Google Business Profile (GBP) registered Google/Gmail account* se hi open/authorize karein.\n\n👉 *Direct Demo Portal:* https://shahidcreatives.com/#combo-demo\n\n- Shahid Creatives (https://shahidcreatives.com)`;

        const finalSuccessMsg = (userLang === 'EN') ? successMsgEN : successMsgHIN;

        const tgOptions = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔗 Connect Google Business Profile (GBP)", url: onboardingLink }],
                    [{ text: "🚀 Notify Authorization (Send to Team)", url: waKickoffLink }]
                ]
            }
        };

        return sendUnifiedMessage(from, finalSuccessMsg, platform, tgOptions);
    }

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
            : "Aapka swagat hai! 👍 Milte hain aapse bohot jald discovery call par. Dobara shuru karne ke liye kisi bhi waqt 'Menu' ya 'Hi' bhejein.\n\n🌐 _Powered by Shahid Creatives_";
        return sendUnifiedMessage(from, courtesyReply, platform);
    }

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
                    coupon_code: "11VI20",
                    email: clientEmail, 
                    discussion_notes: paidAdminAlert
                });
            } catch (err) { }
            
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

        const finalPayable = calculateTotalPayable(calculatedPrice, formIsUSDTrack);

        const adminNotification = `🌟 *NEW WEBSITE LEAD ARRIVED!* 🌟\n\n📱 *Client:* ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${clientName}\n📝 *Plan Scope:* ${projectScope}\n💵 *Base Price:* ${currencyAdmin}${calculatedPrice + savedAmountWeb}\n🔥 *Discount Applied:* ${currencyAdmin}${savedAmountWeb} (11VI20)\n💰 *Calculated Price:* ${currencyAdmin}${calculatedPrice}`;
        sendAdminAlert(adminNotification);

        try {
            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                client_name: clientName, 
                whatsapp_number: from, 
                telegram_chat_id: platform === 'telegram' ? from : undefined, 
                project_scope: projectScope, 
                calculated_price: calculatedPrice, 
                coupon_code: "11VI20",
                email: clientEmail, 
                discussion_notes: adminNotification 
            });
        } catch (err) { }

        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
        const tokenAmount = isINRLead ? 999 : 49;
        const tokenCurrency = isINRLead ? 'INR' : 'USD';
        const guaranteeText = isINRLead ? 'INR Slot Guarantee' : 'USD Slot Guarantee';

        const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${tokenAmount}&currency=${tokenCurrency}&totalPrice=${finalPayable}&name=${encodeURIComponent(clientName)}&email=${encodeURIComponent(clientEmail)}&phone=${from}&plan=${encodeURIComponent(projectScope)}&coupon=11VI20`;

        let clientReply = isINRLead
            ? `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved to our dashboard.\n\n🔥 *11vi Sharif Mubarak!* Aapka **Flat 20% OFF (11VI20)** coupon apply ho chuka hai! Aapne is deal par sidha **₹${savedAmountWeb > 0 ? savedAmountWeb : '20%'}** save kar liya hai. Ye limited-time 11vi Sharif Special Offer expire hone se pehle apna slot lock karein. (*T&C Apply*)\n\n🔗 *Pay Securely Here (${guaranteeText}):* ${selfPayLink}\n\n_Note: Payment verify hote hi Shahid Creatives ki Team seedha aapse sampark karegi!_`
            : `Thank you *${clientName}*! 🙏 Your cost estimation data has been securely saved to our dashboard.\n\n🔥 *11vi Sharif Mubarak!* Your **Flat 20% OFF (11VI20)** coupon is currently applied! You just saved **$${savedAmountWeb > 0 ? savedAmountWeb : '20%'}** on this deal. Lock your slot before this limited-time 11vi Sharif Special Offer expires. (*T&C Apply*)\n\n🔗 *Pay Securely Here (${guaranteeText}):* ${selfPayLink}\n\n_Note: Shahid Creatives' Team will reach out immediately upon confirmation!_`;
        
        return sendUnifiedMessage(from, clientReply, platform);
    }

    if (currentStep === 'nudge_sent_waiting_reply') {
        const positiveTriggers = ['yes', 'yeah', 'yup', 'haan', 'ji', 'help', 'ok', 'okay', 'sure', 'help chahiye', 'bataiye'];
        if (positiveTriggers.includes(userText)) {
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
                ? "Hello! Welcome to *Shahid Creatives*. 🚀\nPlease select an option number to proceed:\n\n1️⃣ **Web & Mobile Development Tiers**\n2️⃣ **AI-Powered Growth Retainers**\n3️⃣ **🚀 Special Combo Offers (🔥 HOT)**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid Creatives' Team (Direct Consultation)**\n6️⃣ **🎁 3-Day Free VIP Demo: Growth Triad (Zero Risk)**\n7️⃣ **📱 Custom Mobile App Development (iOS & Android)**\n8️⃣ **🌐 Complete Meta & WhatsApp AI Automation (FB / IG / WA)**"
                : "Hello! Welcome to *Shahid Creatives*. 🚀\nKoshish ko aage badhane ke liye ek option number reply kijiye:\n\n1️⃣ *Web & Mobile Development Tiers*\n2️⃣ *AI-Powered Growth Retainers*\n3️⃣ *🚀 Special Combo Offers (🔥 HOT)*\n4️⃣ *💳 Direct Booking & Token System*\n5️⃣ *👤 Talk to Shahid Creatives ki Team* (Direct Consultation)\n6️⃣ **🎁 3-Day Free VIP Demo: Growth Triad (Zero Risk)**\n7️⃣ **📱 Custom Mobile App Development (iOS & Android)**\n8️⃣ **🌐 Complete Meta & WhatsApp AI Automation (FB / IG / WA)**";
            return sendUnifiedMessage(from, replyText, platform);
        } else {
            return sendUnifiedMessage(from, "Welcome to *Shahid Creatives*! 🚀 Please select your location layout to proceed:\n\n1️⃣ **India (Tax/Billing: ₹ INR)**\n2️⃣ **Outside India (Global Billing: $ USD)**", platform);
        }
    }

    if (currentStep === 'awaiting_custom_time_input') {
        userSessions[from].requestedSlot = rawText;
        
        if (!userSessions[from].savedPlan) userSessions[from].savedPlan = userSessions[from].projectScope;

        const hasValidIdentity = userSessions[from].skipIdentityCapture || (userSessions[from].clientName && userSessions[from].clientName !== "Valued Client" && userSessions[from].clientEmail && userSessions[from].clientEmail !== "Not Provided" && userSessions[from].clientEmail !== "");

        if (hasValidIdentity) {
            userSessions[from].step = 'post_registration';
            return finalizeConsultationLead(from, userSessions[from].savedPlan || "Consultation Booking", null, platform);
        } else {
            userSessions[from].step = 'collect_consultation_identity';
            userSessions[from].projectScope = `Custom Slot Input ("${rawText}")`;
            
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

    if (currentStep === 'collect_consultation_identity') {
        let cleanName = ""; 
        let cleanEmail = "";
        let cleanPhone = (platform === 'whatsapp') ? from : ""; 
        
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
        userSessions[from].clientPhone = cleanPhone; 

        let descriptivePrompt = (userLang === 'EN')
            ? `Thank you *${cleanName}*! 🙏\n\nTo lock a high-converting strategy blueprint and select your complete plan, please choose an option below:\n\n🌐 **1. Website Development:**\nWhich plan fits your vision? (Starter Plan, Basic Plan, Starter Business Site, or E-Commerce Hub?)\n\n🤖 **2. AI-Powered Growth Retainers:**\nWhat precise processes do you want to automate?\n\n🚀 **3. Special Combo Offers:**\nSelect Plan 1 or Plan 2 (Monthly Retainer or 🎁 Annual Pass with ~30% Savings)!\n\n📱 **4. Custom Mobile App Development:**\nStarter MVP ($399), Business Pro ($799), or Enterprise ($1,499)?\n\n🌐 **5. Meta & WhatsApp AI Automation:**\nMeta Suite, WhatsApp Standalone, or Full Omnichannel?`
            : `Thank you *${cleanName}*! 🙏\n\nStrategy call ko 100% efficient banane aur apna complete plan choose karne ke liye, kripya niche diye gaye options me se select karein:\n\n🌐 **Type 1:** Agar aapko Website chahiye toh specific type likhein (e.g., Landing Page, Corporate Showcase, ya Online Store).\n\n🤖 **Type 2:** Agar AI Architecture/Bot chahiye toh details likhein (e.g., AI SEO, WhatsApp Lead Bot, Sales Engine).\n\n🚀 **Type 3:** Special Combo Offers (Local AI & GMB Growth / Full Digital Scale Launch - Monthly Retainer ya 🎁 Annual Pass).\n\n📱 **Type 4:** Custom Mobile App Development (Starter MVP ₹24,999, Business Pro ₹49,500, ya Enterprise ₹95,000).\n\n🌐 **Type 5:** Complete Meta & WhatsApp Automation (FB / IG / WhatsApp AI Bots).`;
        return sendUnifiedMessage(from, descriptivePrompt, platform);
    }

    if (currentStep === 'collect_custom_query_and_time') {
        const isUSDTrack = (userLang === 'EN');

        if (userText === '1' || userText === '2' || userText === '3' || userText === '4' || userText === '5' || userText.includes('type 1') || userText.includes('type 2') || userText.includes('type 3') || userText.includes('type 4') || userText.includes('type 5') || userText.includes('meta') || userText.includes('whatsapp')) {
            userSessions[from].step = 'awaiting_specific_service_selection';
            
            let catType = 'ai';
            if (userText.includes('1') || userText.includes('web')) catType = 'web';
            else if (userText.includes('3') || userText.includes('combo')) catType = 'combo';
            else if (userText.includes('4') || userText.includes('app')) catType = 'app';
            else if (userText.includes('5') || userText.includes('meta') || userText.includes('whatsapp')) catType = 'meta';
            
            userSessions[from].lastSelectedType = catType;
            
            let interceptorReply = "";
            let options = null;

            if (catType === 'web') {
                interceptorReply = isUSDTrack 
                    ? "⚠️ Please be specific! Which Web or App scope do you need? \n\n👉 Reply with an option number (1-7):\n1️⃣ *Starter Plan* ($199)\n2️⃣ *Basic Plan* ($299)\n3️⃣ *Starter Business Site* ($499)\n4️⃣ *E-Commerce Hub* ($899)\n5️⃣ *Starter Mobile MVP* ($399)\n6️⃣ *Business Pro App* ($799)\n7️⃣ *Enterprise App & Scale* ($1,499)"
                    : "⚠️ Kripya clear batayein! Aapko hamare active modules mein se kis tarah ka web/app chahiye? \n\n👉 Niche diye gaye options mein se ek number (1-7) reply karein:\n1️⃣ *Landing Page/Funnel* (₹12,300)\n2️⃣ *Business/Corporate Website* (Base: ₹25,500)\n3️⃣ *E-commerce Website (Online Store)* (₹47,500)\n4️⃣ *Custom Web Application* (₹1,45,000+)\n5️⃣ *Starter Mobile MVP (App)* (Base: ₹24,999)\n6️⃣ *Business Pro (Dual Store App)* (Base: ₹49,500)\n7️⃣ *Custom Enterprise & Scale (App)* (Base: ₹95,000)";
            } else if (catType === 'combo') {
                interceptorReply = isUSDTrack
                    ? "🚀 *SPECIAL COMBO OFFERS (🔥 HOT)*\n\n👉 Reply with option number (1 to 4):\n\n1️⃣ *PLAN 1: Local AI & GMB Growth [MONTHLY]*\n💰 Setup: $69 (50% OFF) + $39/mo Retainer\n📍 GMB Verification & Map Pack Top 3 SEO\n\n2️⃣ *PLAN 1: Local AI & GMB Growth 🎁 [ANNUAL PASS - SAVE ~25%]*\n💰 Price: $399 / Year (Save $138)\n🎁 Bonus: Free Domain (.com/.in) + Citation Blast + VIP Support\n\n3️⃣ *PLAN 2: Full Digital & AI Scale Launch [MONTHLY]*\n💰 Setup: $169 (35% OFF) + $79/mo Retainer\n💻 Custom Next.js Site + Multi-Client AI Agent\n\n4️⃣ *PLAN 2: Full Digital & AI Scale Launch 🎁 [ANNUAL PASS - SAVE ~30%]*\n💰 Price: $799 / Year (Save $318)\n🎁 Bonus: Free Hosting & Domain + 12 SEO Blogs + WhatsApp AI CRM Sync"
                    : "🚀 *SPECIAL COMBO OFFERS (🔥 HOT)*\n\n👉 Niche me se ek number (1 se 4) reply karein:\n\n1️⃣ *PLAN 1: Local AI & GMB Growth [MONTHLY RETAINER]*\n💰 Setup: ₹4,999 (50% OFF) + Monthly ₹2,499/mo\n📍 Local Map Pack SEO, Citations & Review Bot\n\n2️⃣ *PLAN 1: Local AI & GMB Growth 🎁 [ANNUAL PASS - SAVE ~30%]*\n💰 Price: ₹24,999 / Year (Save ₹10,000)\n🎁 Perks: Free 1-Yr Domain + Citation Blast + Unlimited AI Credits + VIP Support\n\n3️⃣ *PLAN 2: Full Digital & AI Scale Launch [MONTHLY RETAINER]*\n💰 Setup: ₹12,999 (35% OFF) + Monthly ₹4,999/mo\n💻 High-Speed Next.js Website + Multi-Client AI Agent\n\n4️⃣ *PLAN 2: Full Digital & AI Scale Launch 🎁 [ANNUAL PASS - SAVE ~32%]*\n💰 Price: ₹49,999 / Year (Save ₹23,000)\n🎁 Perks: Free Premium Hosting + Domain + 12 SEO Blogs + AI WhatsApp CRM Sync";
            } else if (catType === 'app') {
                interceptorReply = isUSDTrack
                    ? "📱 *CUSTOM MOBILE APP DEVELOPMENT (iOS & Android)*\n\n👉 Reply with an option number (1-3):\n1️⃣ *Starter Mobile MVP* ($399)\n2️⃣ *Business Pro (Dual Store)* ($799)\n3️⃣ *Custom Enterprise & Scale* ($1,499)"
                    : "📱 *CUSTOM MOBILE APP DEVELOPMENT (iOS & Android)*\n\n👉 Niche diye gaye options mein se ek number (1-3) reply karein:\n1️⃣ *Starter Mobile MVP* (₹24,999)\n2️⃣ *Business Pro (Dual Store)* (₹49,500)\n3️⃣ *Custom Enterprise & Scale* (₹95,000)";
            } else if (catType === 'meta') {
                interceptorReply = isUSDTrack
                    ? "🌐 *COMPLETE META & WHATSAPP AI AUTOMATION (USD)*\n_(+20% Extra + 3.5% PG Fee included)_\n\n👉 Reply with an option number (1 to 9):\n\n🔹 *Meta Business (FB / IG):*\n1️⃣ Starter AI Suite (FB / IG) - Setup: $56 | $28/mo\n2️⃣ Growth AI Suite (FB + IG Dual) - Setup: $112 | $56/mo\n3️⃣ Pro AI Suite (Multi-Account & CRM) - Setup: $225 | $112/mo\n\n🔹 *WhatsApp Business (Standalone):*\n4️⃣ WhatsApp Starter - Setup: $22 | $56/mo\n5️⃣ WhatsApp Growth (Bookings & UPI) - Setup: $45 | $112/mo\n6️⃣ WhatsApp Enterprise (Gemini AI Bot) - Setup: $79 | $211/mo\n\n🔹 *Complete Meta Suite (WA + IG + FB):*\n7️⃣ Starter Complete (Meta & WhatsApp) - Setup: $101 | $35/mo\n8️⃣ Growth Complete (Omnichannel Engine) - Setup: $180 | $70/mo\n9️⃣ Business Pro Complete (Enterprise) - Setup: $338 | $127/mo"
                    : "🌐 *COMPLETE META & WHATSAPP AI AUTOMATION (INR)*\n_(18% GST + 2.5% PG Fee | Flat 20% OFF Setup via 11VI20)_\n\n👉 Niche diye gaye options mein se ek number (1 se 9) reply karein:\n\n🔹 *Meta Business (FB / IG):*\n1️⃣ Starter AI Suite (FB / IG) - Setup: ₹3,999 | ₹1,999/mo\n2️⃣ Growth AI Suite (FB + IG Dual) - Setup: ₹7,999 | ₹3,999/mo\n3️⃣ Pro AI Suite (Multi-Account & CRM) - Setup: ₹15,999 | ₹7,999/mo\n\n🔹 *WhatsApp Business (Standalone):*\n4️⃣ WhatsApp Starter - Setup: ₹1,599 | ₹3,999/mo\n5️⃣ WhatsApp Growth - Setup: ₹3,199 | ₹7,999/mo\n6️⃣ WhatsApp Enterprise (Gemini AI Bot) - Setup: ₹5,599 | ₹14,999/mo\n\n🔹 *Complete Meta Suite (WA + IG + FB):*\n7️⃣ Starter Complete (Meta & WhatsApp) - Setup: ₹7,199 | ₹2,499/mo\n8️⃣ Growth Complete (Omnichannel Engine) - Setup: ₹12,799 | ₹4,999/mo\n9️⃣ Business Pro Complete (Enterprise) - Setup: ₹23,999 | ₹8,999/mo";
            } else {
                interceptorReply = isUSDTrack 
                    ? "⚠️ Please be specific! What AI architecture do you want? \n\n👉 Reply with an option number (1-8):\n1️⃣ *Starter Digital Maintainer* ($77)\n2️⃣ *Web Conversion Engine* ($155)\n3️⃣ *Omnichannel Growth Partner* ($311)\n4️⃣ *Full-Scale Ecosystem Operations* ($499)\n5️⃣ *Elite Intelligence* ($799)\n6️⃣ *Telegram Universal Automation - Starter* ($77)\n7️⃣ *Telegram Universal Automation - Growth* ($155)\n8️⃣ *Telegram Universal Automation - Elite* ($311)"
                    : "⚠️ Kripya clear batayein! Aapko kis tarah ka automation stack design karwana hai? \n\n👉 Niche diye gaye options mein se ek number (1-8) reply karein:\n1️⃣ *Starter Digital Maintainer* (₹4,999/Mo)\n2️⃣ *Web Conversion Engine* (₹9,499/Mo)\n3️⃣ *Omnichannel Growth Partner* (₹18,999/Mo)\n4️⃣ *Full-Scale Ecosystem Operations* (₹29,999/Mo)\n5️⃣ *Elite Intelligence & Bespoke Systems* (₹49,999/Mo)\n6️⃣ *Telegram Universal Automation - Starter* (₹3,999/Mo)\n7️⃣ *Telegram Universal Automation - Growth* (₹7,599/Mo)\n8️⃣ *Telegram Universal Automation - Elite* (₹15,199/Mo)";
            }

            if (platform === 'telegram') {
                if (catType === 'meta') {
                    options = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: "1️⃣ Meta Starter", callback_data: "sel_meta_1" }, { text: "2️⃣ Meta Growth", callback_data: "sel_meta_2" }],
                                [{ text: "3️⃣ Meta Pro", callback_data: "sel_meta_3" }, { text: "4️⃣ WA Starter", callback_data: "sel_meta_4" }],
                                [{ text: "5️⃣ WA Growth", callback_data: "sel_meta_5" }, { text: "6️⃣ WA Enterprise", callback_data: "sel_meta_6" }],
                                [{ text: "7️⃣ Omnichannel Starter", callback_data: "sel_meta_7" }],
                                [{ text: "8️⃣ Omnichannel Growth", callback_data: "sel_meta_8" }],
                                [{ text: "9️⃣ Omnichannel Pro", callback_data: "sel_meta_9" }]
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

    if (currentStep === 'awaiting_specific_service_selection') {
        let selectedScope = rawText;
        const isUSDTrack = (userLang === 'EN');
        const cat = userSessions[from].lastSelectedType || 'ai';

        if (cat === 'meta') {
            if (userText === '1') selectedScope = "Starter AI Suite (FB / IG)";
            else if (userText === '2') selectedScope = "Growth AI Suite (FB + IG Dual)";
            else if (userText === '3') selectedScope = "Pro AI Suite (Multi-Account & CRM)";
            else if (userText === '4') selectedScope = "WhatsApp Starter (Visiting Card & Auto-Replies)";
            else if (userText === '5') selectedScope = "WhatsApp Growth (Bookings & UPI Payments)";
            else if (userText === '6') selectedScope = "WhatsApp Enterprise & AI Bot (Gemini AI)";
            else if (userText === '7') selectedScope = "Starter Complete (Meta & WhatsApp)";
            else if (userText === '8') selectedScope = "Growth Complete (Omnichannel Engine)";
            else if (userText === '9') selectedScope = "Business Pro Complete (Enterprise Meta)";
        } else if (cat === 'web') {
            if (isUSDTrack) {
                if (userText === '1') selectedScope = "Starter Plan";
                else if (userText === '2') selectedScope = "Basic Plan";
                else if (userText === '3') selectedScope = "Starter Business Site";
                else if (userText === '4') selectedScope = "E-Commerce Hub";
                else if (userText === '5') selectedScope = "Starter Mobile MVP";
                else if (userText === '6') selectedScope = "Business Pro (Dual Store)";
                else if (userText === '7') selectedScope = "Custom Enterprise & Scale";
            } else {
                if (userText === '1') selectedScope = "Landing Page/Funnel";
                else if (userText === '2') selectedScope = "Business/Corporate Website";
                else if (userText === '3') selectedScope = "E-commerce Website";
                else if (userText === '4') selectedScope = "Custom Web Application";
                else if (userText === '5') selectedScope = "Starter Mobile MVP";
                else if (userText === '6') selectedScope = "Business Pro (Dual Store)";
                else if (userText === '7') selectedScope = "Custom Enterprise & Scale";
            }
        } else if (cat === 'combo') {
            if (userText === '1') selectedScope = "PLAN 1: Local AI & GMB Growth [MONTHLY RETAINER]";
            else if (userText === '2') selectedScope = "PLAN 1: Local AI & GMB Growth 🎁 [ANNUAL PASS - SAVE ~30%]";
            else if (userText === '3') selectedScope = "PLAN 2: Full Digital & AI Scale Launch [MONTHLY RETAINER]";
            else if (userText === '4') selectedScope = "PLAN 2: Full Digital & AI Scale Launch 🎁 [ANNUAL PASS - SAVE ~32%]";
        } else if (cat === 'app') {
            selectedScope = userText === '1' ? "Starter Mobile MVP" : (userText === '2' ? "Business Pro (Dual Store)" : "Custom Enterprise & Scale");
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

    if (currentStep === 'process_meta_automation_menu') {
        let isMetaMatch = false;
        let dynamicCategory = "";

        if (userText === '1' || (userText.includes('starter') && (userText.includes('fb') || userText.includes('meta')))) { dynamicCategory = "Starter AI Suite (FB / IG)"; isMetaMatch = true; }
        else if (userText === '2' || (userText.includes('growth') && (userText.includes('dual') || userText.includes('fb')))) { dynamicCategory = "Growth AI Suite (FB + IG Dual)"; isMetaMatch = true; }
        else if (userText === '3' || (userText.includes('pro') && (userText.includes('multi') || userText.includes('crm')))) { dynamicCategory = "Pro AI Suite (Multi-Account & CRM)"; isMetaMatch = true; }
        else if (userText === '4' || (userText.includes('whatsapp') && userText.includes('starter'))) { dynamicCategory = "WhatsApp Starter (Visiting Card & Auto-Replies)"; isMetaMatch = true; }
        else if (userText === '5' || (userText.includes('whatsapp') && userText.includes('growth'))) { dynamicCategory = "WhatsApp Growth (Bookings & UPI Payments)"; isMetaMatch = true; }
        else if (userText === '6' || (userText.includes('whatsapp') && (userText.includes('enterprise') || userText.includes('gemini')))) { dynamicCategory = "WhatsApp Enterprise & AI Bot (Gemini AI)"; isMetaMatch = true; }
        else if (userText === '7' || (userText.includes('starter') && userText.includes('complete'))) { dynamicCategory = "Starter Complete (Meta & WhatsApp)"; isMetaMatch = true; }
        else if (userText === '8' || (userText.includes('growth') && userText.includes('complete'))) { dynamicCategory = "Growth Complete (Omnichannel Engine)"; isMetaMatch = true; }
        else if (userText === '9' || (userText.includes('business pro') && userText.includes('complete'))) { dynamicCategory = "Business Pro Complete (Enterprise Meta)"; isMetaMatch = true; }

        if (isMetaMatch) {
            userSessions[from].step = 'ask_name_email';
            userSessions[from].projectScope = dynamicCategory;

            let promptText = (userLang === 'EN')
                ? (platform === 'telegram' ? `Awesome! Selected: *${dynamicCategory}*. 🌐\n\n📝 Kindly reply with your **Full Name, Email Address, and Mobile Number** (comma separated).` : `Awesome! Selected: *${dynamicCategory}*. 🌐\n\n📝 Kindly reply with your **Full Name** and **Email Address**.`)
                : (platform === 'telegram' ? `Awesome! Aapne *${dynamicCategory}* select kiya hai. 🌐\n\n📝 Ab kripya apna **Full Name, Email ID, aur Mobile Number** reply mein bhej lijiye.` : `Awesome! Aapne *${dynamicCategory}* select kiya hai. 🌐\n\n📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bhej lijiye.`);

            return sendUnifiedMessage(from, promptText, platform);
        } else {
            return sendUnifiedMessage(from, userLang === 'EN' ? "❌ Invalid selection. Please reply with an option number from 1 to 9." : "❌ Kripya 1 se 9 ke beech koi number reply karein.", platform);
        }
    }

    if (currentStep === 'collect_details') {
        userSessions[from].projectScope = rawText; 
        userSessions[from].step = 'ask_name_email';
        
        let prompt = (userLang === 'EN')
            ? (platform === 'telegram' ? "Awesome! 📝 Kindly reply with your **Full Name, Email Address, and Mobile Number** (comma separated)." : "Awesome! 📝 Kindly reply with your **Full Name** and **Email Address**.")
            : (platform === 'telegram' ? "Awesome! 📝 Kripya apna **Full Name, Email ID, aur Mobile Number** bhej lijiye (comma lagakar)." : "Awesome! 📝 Kripya apna **Full Name** aur **Email ID** bhej lijiye.");
        return sendUnifiedMessage(from, prompt, platform);
    }

    if (currentStep === 'ask_name_email') {
        let cleanName = ""; 
        let cleanEmail = "";
        let cleanPhone = (platform === 'whatsapp') ? from : ""; 
        
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
        userSessions[from].clientPhone = cleanPhone; 
        
        const isUSDTrack = (userLang === 'EN');
        const matchedBasePriceStr = getBasePriceByPlan(userSessions[from].projectScope, isUSDTrack);
        const matchedBasePrice = parseFloat(matchedBasePriceStr);

        const savingAmount = Math.round(matchedBasePrice * 0.20); 
        const discountedBasePrice = matchedBasePrice - savingAmount;

        const finalPayable = calculateTotalPayable(discountedBasePrice, isUSDTrack);
        const currencySymbol = isUSDTrack ? '$' : '₹';

        const displayPhone = userSessions[from].clientPhone || (platform === 'whatsapp' ? from : "Not Provided");

        const chatAdminNotification = `🌟 *NEW INBOUND CHAT LEAD!* 🌟\n\n📱 *Client Contact:* ${displayPhone} ${platform === 'telegram' ? '(Telegram)' : '(WhatsApp)'}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${cleanName}\n✉️ *Email:* ${cleanEmail}\n📝 *Plan Scope:* ${userSessions[from].projectScope}\n💵 *Base Price:* ${currencySymbol}${matchedBasePrice}\n🔥 *Discount Applied:* ${currencySymbol}${savingAmount} (11VI20)\n💰 *Calculated Price:* ${currencySymbol}${finalPayable}`;
        sendAdminAlert(chatAdminNotification);

        try {
            await axios.post('https://shahidcreatives.com/api/whatsapp-leads', { 
                client_name: cleanName, 
                whatsapp_number: displayPhone, 
                telegram_chat_id: platform === 'telegram' ? from : undefined, 
                project_scope: userSessions[from].projectScope, 
                calculated_price: finalPayable, 
                coupon_code: "11VI20",
                email: cleanEmail, 
                discussion_notes: chatAdminNotification 
            });
        } catch (dashboardError) { }

        const uniqueProjectId = `SC-${Math.floor(10000 + Math.random() * 90000)}`;
        const encodedName = encodeURIComponent(cleanName); 
        const encodedEmail = encodeURIComponent(cleanEmail); 
        const encodedPlan = encodeURIComponent(userSessions[from].projectScope);

        const selfPayLink = `https://shahidcreatives.com/#token-booking?projectId=${uniqueProjectId}&amount=${isUSDTrack ? 49 : 999}&currency=${isUSDTrack ? 'USD' : 'INR'}&totalPrice=${finalPayable}&name=${encodedName}&email=${encodedEmail}&phone=${displayPhone}&plan=${encodedPlan}&coupon=11VI20`;

        let replyText = isUSDTrack 
            ? `🎉 *11vi Sharif Mubarak!* Your requirement (*${userSessions[from].projectScope}*) is formally registered.\n\n🔥 *URGENT:* A special **Flat 20% OFF (11VI20)** coupon has been automatically applied to your base price! You are saving **$${savingAmount}** today. Lock your price now before the 11vi Sharif Special Offer expires. (*T&C Apply*)\n\n*Next Steps:*\nTo initiate your project development slot, please process the standard booking token ($49 USD) via our secure gateway below:\n\n🔗 *Secure Checkout Portal:* ${selfPayLink}\n\n_Note: Shahid Creatives' Team will reach out immediately upon confirmation!_\n\n🌐 _Powered by Shahid Creatives_`
            : `🎉 *11vi Sharif Mubarak!* Aapki requirement (*${userSessions[from].projectScope}*) successfully hamare dashboard mein register ho gayi hai.\n\n🔥 *URGENT:* Aapke base price par **Flat 20% OFF (11VI20)** coupon automatically apply kar diya gaya hai! Aaj is deal par aap **₹${savingAmount}** bacha rahe hain. Ye 11vi Sharif Special Offer expire hone se pehle apna price lock karein. (*T&C Apply*)\n\n*Next Steps:*\nApna slot pakka karne aur project shuru karne ke liye kripya apna Token Amount (₹999 INR) niche diye gaye secure payment link par clear karein:\n\n🔗 *Secure Checkout Portal:* ${selfPayLink}\n\n_Note: Payment verify hote hi Shahid Creatives ki Team seedha aapse sampark karegi!_\n\n🌐 _Powered by Shahid Creatives_`;
        
        return sendUnifiedMessage(from, replyText, platform);
    }

    if (currentStep === 'awaiting_website_action') {
        if (userText === '1' || userText.includes("token") || userText.includes("book") || userText.includes("confirm")) {
            userSessions[from].step = 'process_requirement_menu';
            let requirementPrompt = (userLang === 'EN')
                ? "Please select what you want to build today by replying with the option number (**1 to 7**):\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Starter Mobile MVP ($399)\n6️⃣ Business Pro App ($799)\n7️⃣ Custom Enterprise & Scale ($1,499)"
                : "Perfect! Pehle aapki structural requirement lock kar lete hain. 🚀\n\nNiche diye gaye options mein se koi ek number (*1 se 7*) reply kijiye:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)\n5️⃣ **Starter Mobile MVP** (Base: ₹24,999)\n6️⃣ **Business Pro (Dual Store App)** (Base: ₹49,500)\n7️⃣ **Custom Enterprise & Scale App** (Base: ₹95,000)";
            return sendUnifiedMessage(from, requirementPrompt, platform);
        } else if (userText === '2' || userText.includes("discuss") || userText.includes("call") || userText.includes("strategy")) {
            userSessions[from].step = 'post_registration';
            return sendUnifiedMessage(from, (userLang === 'EN') ? "👤 Perfect! Shahid Creatives' Team will connect with you shortly for a strategy sync call.\n\n🌐 _Powered by Shahid Creatives_" : "👤 Perfect! Shahid Creatives ki Team bohot jald aapke sath strategy call par connect karegi. Get ready to launch! 🚀\n\n🌐 _Powered by Shahid Creatives_", platform);
        }
    }

    if (currentStep === 'process_requirement_menu') {
        let isMatchFound = false; 
        let dynamicCategory = ""; 
        const isUSDTrack = (userLang === 'EN');

        if (isUSDTrack) {
            if (userText === '1' || userText.includes("starter plan")) { dynamicCategory = "Starter Plan"; isMatchFound = true; }
            else if (userText === '2' || userText.includes("basic plan")) { dynamicCategory = "Basic Plan"; isMatchFound = true; }
            else if (userText === '3' || userText.includes("starter business")) { dynamicCategory = "Starter Business Site"; isMatchFound = true; }
            else if (userText === '4' || userText.includes("e-commerce hub")) { dynamicCategory = "E-Commerce Hub"; isMatchFound = true; }
            else if (userText === '5' || userText.includes("starter mobile") || userText.includes("mvp")) { dynamicCategory = "Starter Mobile MVP"; isMatchFound = true; }
            else if (userText === '6' || userText.includes("business pro") || userText.includes("dual")) { dynamicCategory = "Business Pro (Dual Store)"; isMatchFound = true; }
            else if (userText === '7' || userText.includes("custom enterprise") || userText.includes("scale")) { dynamicCategory = "Custom Enterprise & Scale"; isMatchFound = true; }
        } else {
            if (userText === '1' || userText.includes("landing")) { dynamicCategory = "Landing Page/Funnel (Single Page Lead Gen)"; isMatchFound = true; }
            else if (userText === '2' || userText.includes("business/corporate") || userText.includes("corporate")) { dynamicCategory = "Business/Corporate Website (Brand Showcase)"; isMatchFound = true; }
            else if (userText === '3' || userText.includes("e-commerce")) { dynamicCategory = "E-commerce Website (Online Store)"; isMatchFound = true; }
            else if (userText === '4' || userText.includes("software") || userText.includes("custom web application")) { dynamicCategory = "Custom Web Application / Software"; isMatchFound = true; }
            else if (userText === '5' || userText.includes("starter mobile") || userText.includes("mvp")) { dynamicCategory = "Starter Mobile MVP"; isMatchFound = true; }
            else if (userText === '6' || userText.includes("business pro") || userText.includes("dual")) { dynamicCategory = "Business Pro (Dual Store)"; isMatchFound = true; }
            else if (userText === '7' || userText.includes("custom enterprise") || userText.includes("scale")) { dynamicCategory = "Custom Enterprise & Scale"; isMatchFound = true; }
        }

        if (isMatchFound) {
            userSessions[from].step = 'ask_name_email'; 
            userSessions[from].projectScope = dynamicCategory;
            
            let promptText = (userLang === 'EN')
                ? (platform === 'telegram' ? `Awesome! Selected: *${dynamicCategory}*. 📝 Kindly reply with your **Full Name, Email Address, and Mobile Number** (comma separated).` : `Awesome! Selected: *${dynamicCategory}*. 📝 Kindly reply with your **Full Name** and **Email Address**.`)
                : (platform === 'telegram' ? `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📝 Ab kripya apna **Full Name, Email ID, aur Mobile Number** reply mein bhej lijiye.` : `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bhej lijiye.`);
            
            return sendUnifiedMessage(from, promptText, platform);
        } else {
            return sendUnifiedMessage(from, isUSDTrack ? "❌ Invalid choice. Please reply with 1 to 7." : "❌ Samajh nahi paye. Kripya 1 se 7 ke beech koi number reply karein.", platform);
        }
    }

    if (currentStep === 'process_automation_menu') {
        let isAutomateMatch = false;
        let dynamicCategory = "";

        if (userText === '1' || userText.includes("starter digital") || userText.includes("maintainer")) { dynamicCategory = "Starter Digital Maintainer"; isAutomateMatch = true; }
        else if (userText === '2' || userText.includes("web conversion") || userText.includes("conversion engine")) { dynamicCategory = "Web Conversion Engine"; isAutomateMatch = true; }
        else if (userText === '3' || userText.includes("omnichannel") || userText.includes("growth partner")) { dynamicCategory = "Omnichannel Growth Partner"; isAutomateMatch = true; }
        else if (userText === '4' || userText.includes("ecosystem") || userText.includes("full-scale")) { dynamicCategory = "Full-Scale Ecosystem Operations"; isAutomateMatch = true; }
        else if (userText === '5' || userText.includes("elite intelligence") || userText.includes("bespoke systems")) { dynamicCategory = "Elite Intelligence & Bespoke Systems"; isAutomateMatch = true; }
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

    if (currentStep === 'process_combo_menu') {
        let isComboMatch = false;
        let dynamicCategory = "";

        if (userText === '1') {
            dynamicCategory = "PLAN 1: Local AI & GMB Growth [MONTHLY RETAINER]";
            isComboMatch = true;
        } else if (userText === '2') {
            dynamicCategory = "PLAN 1: Local AI & GMB Growth 🎁 [ANNUAL PASS - SAVE ~30%]";
            isComboMatch = true;
        } else if (userText === '3') {
            dynamicCategory = "PLAN 2: Full Digital & AI Scale Launch [MONTHLY RETAINER]";
            isComboMatch = true;
        } else if (userText === '4') {
            dynamicCategory = "PLAN 2: Full Digital & AI Scale Launch 🎁 [ANNUAL PASS - SAVE ~32%]";
            isComboMatch = true;
        }

        if (isComboMatch) {
            userSessions[from].step = 'ask_name_email';
            userSessions[from].projectScope = dynamicCategory;

            let promptText = (userLang === 'EN')
                ? (platform === 'telegram' ? `Awesome! Selected: *${dynamicCategory}*. 🚀\n\n⚠️ *Package Note:* Domain Name & Hosting Fees are NOT included in Monthly setups. Annual Passes include Free Hosting & Domain Perks!\n\n📝 Kindly reply with your **Full Name, Email Address, and Mobile Number** (comma separated).` : `Awesome! Selected: *${dynamicCategory}*. 🚀\n\n⚠️ *Package Note:* Domain Name & Hosting Fees are NOT included in Monthly setups. Annual Passes include Free Hosting & Domain Perks!\n\n📝 Kindly reply with your **Full Name** and **Email Address**.`)
                : (platform === 'telegram' ? `Awesome! Aapne *${dynamicCategory}* select kiya hai. 🚀\n\n⚠️ *Package Note:* Monthly setups me Domain/Hosting included nahi hai. Annual Passes me Free Domain & Premium Hosting perks milte hain!\n\n📝 Ab kripya apna **Full Name, Email ID, aur Mobile Number** reply mein bhej lijiye.` : `Awesome! Aapne *${dynamicCategory}* select kiya hai. 🚀\n\n⚠️ *Package Note:* Monthly setups me Domain/Hosting included nahi hai. Annual Passes me Free Domain & Premium Hosting perks milte hain!\n\n📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bhej lijiye.`);

            return sendUnifiedMessage(from, promptText, platform);
        } else {
            return sendUnifiedMessage(from, userLang === 'EN' ? "❌ Invalid selection. Please reply with 1, 2, 3, or 4." : "❌ Kripya 1, 2, 3 ya 4 likh kar reply karein.", platform);
        }
    }

    if (currentStep === 'process_app_menu') {
        let isAppMatch = false;
        let dynamicCategory = "";
        const isUSDTrack = (userLang === 'EN');

        if (userText === '1' || userText.includes("starter") || userText.includes("mvp")) {
            dynamicCategory = "Starter Mobile MVP";
            isAppMatch = true;
        } else if (userText === '2' || userText.includes("business") || userText.includes("dual")) {
            dynamicCategory = "Business Pro (Dual Store)";
            isAppMatch = true;
        } else if (userText === '3' || userText.includes("enterprise") || userText.includes("scale")) {
            dynamicCategory = "Custom Enterprise & Scale";
            isAppMatch = true;
        }

        if (isAppMatch) {
            userSessions[from].step = 'ask_name_email';
            userSessions[from].projectScope = dynamicCategory;

            let promptText = isUSDTrack
                ? (platform === 'telegram' ? `Awesome! Selected: *${dynamicCategory}*. 📱\n\n📝 Kindly reply with your **Full Name, Email Address, and Mobile Number** (comma separated).` : `Awesome! Selected: *${dynamicCategory}*. 📱\n\n📝 Kindly reply with your **Full Name** and **Email Address**.`)
                : (platform === 'telegram' ? `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📱\n\n📝 Ab kripya apna **Full Name, Email ID, aur Mobile Number** reply mein bhej lijiye.` : `Awesome! Aapne *${dynamicCategory}* select kiya hai. 📱\n\n📝 Ab kripya apna **Full Name** aur **Email ID** reply mein bhej lijiye.`);

            return sendUnifiedMessage(from, promptText, platform);
        } else {
            return sendUnifiedMessage(from, isUSDTrack ? "❌ Invalid selection. Please reply with 1, 2, or 3." : "❌ Kripya 1, 2, ya 3 likh kar reply karein.", platform);
        }
    }

    if (currentStep === 'awaiting_consultation_slot') {
        const currentHourIST = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"})).getHours();
        let chosenOptionClean = userText.replace(/[\-\*•\(\)]/g, '').trim();
        
        if (!userSessions[from].savedPlan) userSessions[from].savedPlan = userSessions[from].projectScope;
        const hasValidIdentity = userSessions[from].skipIdentityCapture || (userSessions[from].clientName && userSessions[from].clientName !== "Valued Client" && userSessions[from].clientEmail && userSessions[from].clientEmail !== "Not Provided" && userSessions[from].clientEmail !== "");
        
        if (chosenOptionClean === 'a' || chosenOptionClean.includes("today") || chosenOptionClean.includes("5")) {
            const dynamicSlotLabel = (currentHourIST >= 17) ? "Tomorrow at 5:00 PM" : "Today at 5:00 PM";
            userSessions[from].requestedSlot = dynamicSlotLabel; 
            sendAdminAlert(`🚨 *SLOT REQUEST!* 🚨\n📱 ${platform === 'telegram' ? 'TG-' : '+'}${from}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n⏰ Chosen Slot: ${dynamicSlotLabel}`);
            
            if (hasValidIdentity) {
                userSessions[from].step = 'collect_custom_query_and_time'; 
                let descriptivePrompt = (userLang === 'EN')
                    ? `Thank you *${session.clientName}*! 🙏\n\nTo lock a high-converting strategy blueprint, please share your goals in the next reply:\n\n🌐 **1. Website Development:**\nWhich plan fits your vision? (Starter Plan, Basic Plan, Starter Business Site, or E-Commerce Hub?)\n\n🤖 **2. AI-Powered Growth Retainers:**\nWhat precise processes do you want to automate?\n\n🚀 **3. Special Combo Offers:**\nSelect Plan 1 or Plan 2 (Monthly Retainer or 🎁 Annual Pass with ~30% Savings)!\n\n📱 **4. Custom Mobile App Development:**\nStarter MVP ($399), Business Pro ($799), or Enterprise ($1,499)?\n\n🌐 **5. Meta & WhatsApp AI Automation:**\nMeta Suite, WhatsApp Standalone, or Full Omnichannel?`
                    : `Thank you *${session.clientName}*! 🙏\n\nStrategy call ko 100% efficient banane ke liye, kripya agle message mein niche di gayi details batayein:\n\n🌐 **Type 1:** Agar aapko Website chahiye toh specific type likhein (e.g., Landing Page, Corporate Showcase, ya Online Store).\n\n🤖 **Type 2:** Agar AI Architecture/Bot chahiye toh details likhein (e.g., AI SEO, WhatsApp Lead Bot, Sales Engine).\n\n🚀 **Type 3:** Special Combo Offers (Local AI & GMB Growth / Full Digital Scale Launch - Monthly Retainer ya 🎁 Annual Pass).\n\n📱 **Type 4:** Custom Mobile App Development (Starter MVP ₹24,999, Business Pro ₹49,500, ya Enterprise ₹95,000).\n\n🌐 **Type 5:** Complete Meta & WhatsApp Automation (FB / IG / WhatsApp AI Bots).`;
                return sendUnifiedMessage(from, descriptivePrompt, platform);
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
                userSessions[from].step = 'collect_custom_query_and_time'; 
                let descriptivePrompt = (userLang === 'EN')
                    ? `Thank you *${session.clientName}*! 🙏\n\nTo lock a high-converting strategy blueprint, please share your goals in the next reply:\n\n🌐 **1. Website Development:**\nWhich plan fits your vision? (Starter Plan, Basic Plan, Starter Business Site, or E-Commerce Hub?)\n\n🤖 **2. AI-Powered Growth Retainers:**\nWhat precise processes do you want to automate?\n\n🚀 **3. Special Combo Offers:**\nSelect Plan 1 or Plan 2 (Monthly Retainer or 🎁 Annual Pass with ~30% Savings)!\n\n📱 **4. Custom Mobile App Development:**\nStarter MVP ($399), Business Pro ($799), or Enterprise ($1,499)?\n\n🌐 **5. Meta & WhatsApp AI Automation:**\nMeta Suite, WhatsApp Standalone, or Full Omnichannel?`
                    : `Thank you *${session.clientName}*! 🙏\n\nStrategy call ko 100% efficient banane ke liye, kripya agle message mein niche di gayi details batayein:\n\n🌐 **Type 1:** Agar aapko Website chahiye toh specific type likhein (e.g., Landing Page, Corporate Showcase, ya Online Store).\n\n🤖 **Type 2:** Agar AI Architecture/Bot chahiye toh details likhein (e.g., AI SEO, WhatsApp Lead Bot, Sales Engine).\n\n🚀 **Type 3:** Special Combo Offers (Local AI & GMB Growth / Full Digital Scale Launch - Monthly Retainer ya 🎁 Annual Pass).\n\n📱 **Type 4:** Custom Mobile App Development (Starter MVP ₹24,999, Business Pro ₹49,500, ya Enterprise ₹95,000).\n\n🌐 **Type 5:** Complete Meta & WhatsApp Automation (FB / IG / WhatsApp AI Bots).`;
                return sendUnifiedMessage(from, descriptivePrompt, platform);
            } else {
                userSessions[from].step = 'collect_consultation_identity'; 
                let idPrompt = (userLang === 'EN') 
                    ? (platform === 'telegram' ? "✍ *Please complete your profile:* Kindly reply with your *Full Name, Email Address, and Mobile Number* (separated by commas, e.g. John Doe, john@email.com, 9876543210)." : "✍ *Please complete your profile:* Kindly reply with your *Full Name and Email Address* (separated by a comma, e.g. John Doe, john@email.com).")
                    : (platform === 'telegram' ? "✍ *Apna profile register karein:* Kripya apna *Full Name, Email ID, aur Mobile Number* reply mein comma (,) lagakar ek sath bhejien (jaise: Sarfaraj Khan, sarfaraj@gmail.com, 9876543210)." : "✍ *Apna profile register karein:* Kripya apna *Full Name, Email ID* reply mein comma (,) lagakar ek sath bhejien (jaise: Sarfaraj Khan, sarfaraj@gmail.com).");
                return sendUnifiedMessage(from, idPrompt, platform);
            }
        } else if (chosenOptionClean === 'c' || chosenOptionClean.includes("custom")) {
            userSessions[from].step = 'awaiting_custom_time_input';
            userSessions[from].skipIdentityCapture = hasValidIdentity; 
            return sendUnifiedMessage(from, (userLang === 'EN') 
                ? "📅 *Custom Scheduling Activated!*\n\nOur timing is *11:00 AM to 5:00 PM (Friday OFF)*.\nPlease type your preferred **Date and Time** below (e.g., *Tomorrow at 3 PM*):" 
                : "📅 *Custom Scheduling Active!*\n\nHumari timing *11:00 AM se 5:00 PM (Friday OFF)* hai.\nKripya jis **Date aur Time** par aap call chahte hain, use niche type karke send karein (jaise: *Kal dopahar 3 baje*):", platform);
        }
    }

    if (currentStep === 'welcome' || currentStep === 'main_menu') {
        userSessions[from].step = 'main_menu';
        let isCoreMatch = false; let targetMenuRoute = userText;

        if (userText === '1' || userText.includes("web") || userText.includes("site")) { targetMenuRoute = '1'; isCoreMatch = true; }
        else if (userText === '2' || userText.includes("automation") || userText.includes("retainer") || userText.includes("bot") || userText.includes("ai")) { targetMenuRoute = '2'; isCoreMatch = true; }
        else if (userText === '3' || userText.includes("combo") || userText.includes("offer") || userText.includes("special")) { targetMenuRoute = '3'; isCoreMatch = true; }
        else if (userText === '4' || userText.includes("book") || userText.includes("token")) { targetMenuRoute = '4'; isCoreMatch = true; }
        else if (userText === '5' || userText.includes("shahid") || userText.includes("talk")) { targetMenuRoute = '5'; isCoreMatch = true; }
        else if (userText === '6' || userText.includes("demo") || userText.includes("free")) { targetMenuRoute = '6'; isCoreMatch = true; }
        else if (userText === '7' || userText.includes("app") || userText.includes("mobile") || userText.includes("android") || userText.includes("ios")) { targetMenuRoute = '7'; isCoreMatch = true; }
        else if (userText === '8' || userText.includes("meta") || userText.includes("whatsapp package") || userText.includes("omnichannel")) { targetMenuRoute = '8'; isCoreMatch = true; }

        if (!isCoreMatch) {
            let replyText = (userSessions[from].lang === 'EN')
                ? "Hello! Welcome to *Shahid Creatives*. 🚀\nPlease select an option number to proceed:\n\n1️⃣ **Web & Mobile Development Tiers**\n2️⃣ **AI-Powered Growth Retainers**\n3️⃣ **🚀 Special Combo Offers (🔥 HOT)**\n4️⃣ **💳 Direct Booking & Token System**\n5️⃣ **👤 Talk to Shahid Creatives' Team (Direct Consultation)**\n6️⃣ **🎁 3-Day Free VIP Demo: Growth Triad (Zero Risk)**\n7️⃣ **📱 Custom Mobile App Development (iOS & Android)**\n8️⃣ **🌐 Complete Meta & WhatsApp AI Automation (FB / IG / WA)**"
                : "Hello! Welcome to *Shahid Creatives*. 🚀\nKoshish ko aage badhane ke liye ek option number reply kijiye:\n\n1️⃣ *Web & Mobile Development Tiers*\n2️⃣ *AI-Powered Growth Retainers*\n3️⃣ *🚀 Special Combo Offers (🔥 HOT)*\n4️⃣ *💳 Direct Booking & Token System*\n5️⃣ *👤 Talk to Shahid Creatives ki Team* (Direct Consultation)\n6️⃣ **🎁 3-Day Free VIP Demo: Growth Triad (Zero Risk)**\n7️⃣ **📱 Custom Mobile App Development (iOS & Android)**\n8️⃣ **🌐 Complete Meta & WhatsApp AI Automation (FB / IG / WA)**";
            return sendUnifiedMessage(from, replyText, platform);
        }

        if (targetMenuRoute === '1') {
            userSessions[from].step = 'process_requirement_menu'; 
            return sendUnifiedMessage(from, (userSessions[from].lang === 'EN') 
                ? "Please select what you want to build today by replying with option number:\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Starter Mobile MVP ($399)\n6️⃣ Business Pro App ($799)\n7️⃣ Custom Enterprise & Scale ($1,499)" 
                : "Kripya select kijiye ki aap kya banwana chahte hain, reply mein number bheinjein:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website (Online Store)** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)\n5️⃣ **Starter Mobile MVP (App)** (Base: ₹24,999)\n6️⃣ **Business Pro (Dual Store App)** (Base: ₹49,500)\n7️⃣ **Custom Enterprise & Scale (App)** (Base: ₹95,000)", platform);
        } else if (targetMenuRoute === '2') {
            userSessions[from].step = 'process_automation_menu';
            return sendUnifiedMessage(from, (userSessions[from].lang === 'EN')
                ? "🤖 **AI-Powered Growth Retainers & Telegram Bots**\nPlease reply with an option number (**1 to 8**):\n\n1️⃣ Starter Digital Maintainer ($77/Mo)\n2️⃣ Web Conversion Engine ($155/Mo)\n3️⃣ Omnichannel Growth Partner ($311/Mo)\n4️⃣ Full-Scale Ecosystem Operations ($499/Mo)\n5️⃣ Elite Intelligence & Bespoke Systems ($799/Mo)\n6️⃣ Telegram Universal Automation - Starter ($77/Mo)\n7️⃣ Telegram Universal Automation - Growth ($155/Mo)\n8️⃣ Telegram Universal Automation - Elite ($311/Mo)\n\n📲 *Live Demo:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo"
                : "🤖 **AI-Powered Growth Retainers & Telegram Bots**\nKripya niche diye gaye list mein se ek option number (**1 se 8**) ya naam reply kijiye:\n\n1️⃣ **Starter Digital Maintainer** (Base: ₹4,999/Mo)\n2️⃣ **Web Conversion Engine** (Base: ₹9,499/Mo)\n3️⃣ **Omnichannel Growth Partner** (Base: ₹18,999/Mo)\n4️⃣ **Full-Scale Ecosystem Operations** (Base: ₹29,999/Mo)\n5️⃣ **Elite Intelligence & Bespoke Systems** (Base: ₹49,999/Mo)\n6️⃣ **Telegram Universal Automation - Starter** (Base: ₹3,999/Mo)\n7️⃣ **Telegram Universal Automation - Growth** (Base: ₹7,599/Mo)\n8️⃣ **Telegram Universal Automation - Elite** (Base: ₹15,199/Mo)\n\n📲 *Live Demo Link:* https://shahidcreatives.com/?demo_cat=b2b_wholesale&mode=whatsapp#demo", platform);
        } else if (targetMenuRoute === '3') {
            userSessions[from].step = 'process_combo_menu';
            return sendUnifiedMessage(from, (userSessions[from].lang === 'EN')
                ? "🚀 *SPECIAL COMBO OFFERS (🔥 HOT)*\n\nPlease select your preferred Special Combo Package & Billing Cycle by replying with 1, 2, 3, or 4:\n\n1️⃣ **PLAN 1: Local AI & GMB Growth [MONTHLY]**\n• Price: Setup $69 + $39/mo\n\n2️⃣ **PLAN 1: Local AI & GMB Growth 🎁 [ANNUAL PASS - SAVE ~25%]**\n• Price: $399/Year (Save $138)\n• Bonus: Free Domain + Citation Blast + VIP Support\n\n3️⃣ **PLAN 2: Full Digital & AI Scale Launch [MONTHLY]**\n• Price: Setup $169 + $79/mo\n\n4️⃣ **PLAN 2: Full Digital & AI Scale Launch 🎁 [ANNUAL PASS - SAVE ~32%]**\n• Price: $799/Year (Save $318)\n• Bonus: Free Premium Hosting + Domain + 12 SEO Blogs + AI CRM Sync\n\n⚠️ *Package Note:* Domain & Hosting Fees are NOT included in Monthly setups. Annual Passes include Free Hosting & Domain Perks!"
                : "🚀 *SPECIAL COMBO OFFERS (🔥 HOT)*\n\nKripya apna preferred Special Combo Package aur Billing Cycle chunne ke liye 1, 2, 3 ya 4 reply karein:\n\n1️⃣ **PLAN 1: Local AI & GMB Growth [MONTHLY RETAINER]**\n• Price: Setup ₹4,999 + Monthly ₹2,499/mo\n\n2️⃣ **PLAN 1: Local AI & GMB Growth 🎁 [ANNUAL PASS - SAVE ~30%]**\n• Price: ₹24,999/Year (Bachat ₹10,000)\n• Bonus Perks: Free 1-Yr Domain + Citation Blast + VIP Support\n\n3️⃣ **PLAN 2: Full Digital & AI Scale Launch [MONTHLY RETAINER]**\n• Price: Setup ₹12,999 + Monthly ₹4,999/mo\n\n4️⃣ **PLAN 2: Full Digital & AI Scale Launch 🎁 [ANNUAL PASS - SAVE ~32%]**\n• Price: ₹49,999/Year (Bachat ₹23,000)\n• Bonus Perks: Free Premium Hosting + Domain + 12 SEO Blogs + AI WhatsApp CRM Sync\n\n⚠️ *Package Note:* Monthly packages me Domain & Hosting Fees included nahi hai. Annual Pass me Free Hosting aur Domain Perks shamil hain!", platform);
        } else if (targetMenuRoute === '4') {
            userSessions[from].step = 'process_requirement_menu';
            return sendUnifiedMessage(from, (userSessions[from].lang === 'EN')
                ? "💳 *Direct Booking & Token System ($49)*\n\nPlease select the project type you want to lock slot for via option number:\n\n1️⃣ Starter Plan ($199)\n2️⃣ Basic Plan ($299)\n3️⃣ Starter Business Site ($499)\n4️⃣ E-Commerce Hub ($899)\n5️⃣ Starter Mobile MVP ($399)\n6️⃣ Business Pro App ($799)\n7️⃣ Custom Enterprise & Scale ($1,499)"
                : "💳 *Direct Booking & Token System (₹999 Slot Lock)*\n\nAap jis project layout ke liye secure token register karna chahte hain, kripya uska option number bheinje:\n\n1️⃣ **Landing Page/Funnel** (Base: ₹12,300)\n2️⃣ **Business/Corporate Website** (Base: ₹25,500)\n3️⃣ **E-commerce Website** (Base: ₹47,500)\n4️⃣ **Custom Web Application / Software** (Base: ₹1,45,000+)\n5️⃣ **Starter Mobile MVP (App)** (Base: ₹24,999)\n6️⃣ **Business Pro (Dual Store App)** (Base: ₹49,500)\n7️⃣ **Custom Enterprise & Scale (App)** (Base: ₹95,000)", platform);
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
        } else if (targetMenuRoute === '6') {
            userSessions[from].step = 'demo_activation_submit';
            userSessions[from].projectScope = "3-Day Free VIP Demo";
            
            const demoMsg = (userLang === 'EN')
                ? "🎁 *3-Day Free VIP Demo: Growth Triad (100% Free - Zero Risk)*\n\nExperience our entire automated revenue engine for 72 hours with no upfront cost or credit card:\n\n1️⃣ *Google Business Profile (GMB) AI Engine* (Auto 5-star review replies & Maps rank booster)\n2️⃣ *Hyper-Local SEO Audit Simulator* (Competitor keyword ranking gaps & citation score)\n3️⃣ *24/7 Telegram & Meta-Verified WhatsApp Business API Bot* (Official verified integration — Instant 3-sec reply & qualification)\n\n⚡ *Setup ready in 5 hours to 1 working day | Zero Risk Guarantee | ✅ Official Meta Business Verified*\n\n👇 *ACTIVATE YOUR DEMO NOW*\nPlease copy the form below, fill in your details, and reply. We will configure your dedicated node immediately:\n\n*Business or Brand Name:*\n*Contact Person Name:*\n*WhatsApp / Phone Number:*\n*Email Address (Optional):*\n*Target City / Location:*\n*Business Category:* (e.g., Local Services, Real Estate, Healthcare, etc.)\n*Website URL or Maps Link:*\n*Special Requirements:* "
                : "🎁 *3-Day Free VIP Demo: Growth Triad (100% Free - Zero Risk)*\n\nBina kisi upfront cost ya credit card ke 72 hours tak hamara complete automated revenue engine test karein:\n\n1️⃣ *Google Business Profile (GMB) AI Engine* (Auto 5-star review replies & Maps rank booster)\n2️⃣ *Hyper-Local SEO Audit Simulator* (Competitor keyword ranking gaps & citation score)\n3️⃣ *24/7 Telegram & Meta-Verified WhatsApp Business API Bot* (Official verified integration — Instant 3-sec reply & qualification)\n\n⚡ *Setup ready in 5 hours to 1 working day | Zero Risk Guarantee | ✅ Official Meta Business Verified*\n\n👇 *ACTIVATE YOUR DEMO NOW*\nKripya niche diye gaye form ko copy karein, apni details bharein aur humein bhejein. Hum turant aapka dedicated node configure kar denge:\n\n*Business or Brand Name:*\n*Contact Person Name:*\n*WhatsApp / Phone Number:*\n*Email Address (Optional):*\n*Target City / Location:*\n*Business Category:* (e.g., Local Services, Real Estate, Healthcare, etc.)\n*Website URL or Maps Link:*\n*Special Requirements:* ";
            return sendUnifiedMessage(from, demoMsg, platform);
        } else if (targetMenuRoute === '7') {
            userSessions[from].step = 'process_app_menu';
            return sendUnifiedMessage(from, (userSessions[from].lang === 'EN')
                ? "📱 **Custom Mobile App Development (iOS & Android)**\nPlease reply with an option number (**1 to 3**):\n\n1️⃣ **Starter Mobile MVP** ($399)\n• Core native/hybrid flow, basic API sync & user auth\n\n2️⃣ **Business Pro (Dual Store)** ($799)\n• Complete Play Store + App Store release, push notifications & payment gateway\n\n3️⃣ **Custom Enterprise & Scale** ($1,499)\n• Real-time architectures, multi-tenant databases & custom backend integrations"
                : "📱 **Custom Mobile App Development (iOS & Android)**\nKripya niche diye gaye list mein se ek option number (**1 se 3**) reply kijiye:\n\n1️⃣ **Starter Mobile MVP** (₹24,999)\n• Fast-to-market MVP, basic API sync & user login system\n\n2️⃣ **Business Pro (Dual Store)** (₹49,500)\n• Android + iOS dual release, push alerts & payment gateways\n\n3️⃣ **Custom Enterprise & Scale** (₹95,000)\n• Complex workflows, real-time database, scale architecture & admin dashboard", platform);
        } else if (targetMenuRoute === '8') {
            userSessions[from].step = 'process_meta_automation_menu';
            const isUSDTrack = (userSessions[from].lang === 'EN');

            const menu8Text = isUSDTrack
                ? "🌐 *COMPLETE META & WHATSAPP AI AUTOMATION (USD PLANS)*\n_(+20% Extra + 3.5% PG Fee included | 🌙 Flat 20% OFF Setup via 11VI20)_\n\n👉 Reply with an option number (**1 to 9**):\n\n🔹 *Meta Business (FB / IG):*\n1️⃣ **Starter AI Suite (FB / IG)** - Setup: $56 (Was $70) | $28/mo\n2️⃣ **Growth AI Suite (FB + IG Dual)** - Setup: $112 (Was $140) | $56/mo\n3️⃣ **Pro AI Suite (Multi-Account & CRM)** - Setup: $225 (Was $280) | $112/mo\n\n🔹 *WhatsApp Business (Standalone):*\n4️⃣ **WhatsApp Starter** - Setup: $22 (Was $28) | $56/mo\n5️⃣ **WhatsApp Growth** - Setup: $45 (Was $56) | $112/mo\n6️⃣ **WhatsApp Enterprise (Gemini AI)** - Setup: $79 (Was $98) | $211/mo\n\n🔹 *Complete Meta Suite (Omnichannel WA+IG+FB):*\n7️⃣ **Starter Complete** - Setup: $101 (Was $126) | $35/mo\n8️⃣ **Growth Complete** - Setup: $180 (Was $225) | $70/mo\n9️⃣ **Business Pro Complete** - Setup: $338 (Was $423) | $127/mo"
                : "🌐 *COMPLETE META & WHATSAPP AI AUTOMATION (INR PLANS)*\n_(18% GST + 2.5% PG Fee | 🌙 Code 11VI20 Applied - Flat 20% OFF Setup)_\n\n👉 Reply with an option number (**1 se 9**):\n\n🔹 *Meta Business (FB / IG):*\n1️⃣ **Starter AI Suite (FB / IG)** - Setup: ₹3,999 (Was ₹4,999) | ₹1,999/mo\n2️⃣ **Growth AI Suite (FB + IG Dual)** - Setup: ₹7,999 (Was ₹9,999) | ₹3,999/mo\n3️⃣ **Pro AI Suite (Multi-Account & CRM)** - Setup: ₹15,999 (Was ₹19,999) | ₹7,999/mo\n\n🔹 *WhatsApp Business (Standalone):*\n4️⃣ **WhatsApp Starter** - Setup: ₹1,599 (Was ₹1,999) | ₹3,999/mo\n5️⃣ **WhatsApp Growth** - Setup: ₹3,199 (Was ₹3,999) | ₹7,999/mo\n6️⃣ **WhatsApp Enterprise (Gemini AI)** - Setup: ₹5,599 (Was ₹6,999) | ₹14,999/mo\n\n🔹 *Complete Meta Suite (Omnichannel WA+IG+FB):*\n7️⃣ **Starter Complete** - Setup: ₹7,199 (Was ₹8,999) | ₹2,499/mo\n8️⃣ **Growth Complete** - Setup: ₹12,799 (Was ₹15,999) | ₹4,999/mo\n9️⃣ **Business Pro Complete** - Setup: ₹23,999 (Was ₹29,999) | ₹8,999/mo";

            let tgOptions = null;
            if (platform === 'telegram') {
                tgOptions = {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: "1️⃣ Meta Starter", callback_data: "sel_meta_1" }, { text: "2️⃣ Meta Growth", callback_data: "sel_meta_2" }],
                            [{ text: "3️⃣ Meta Pro", callback_data: "sel_meta_3" }, { text: "4️⃣ WA Starter", callback_data: "sel_meta_4" }],
                            [{ text: "5️⃣ WA Growth", callback_data: "sel_meta_5" }, { text: "6️⃣ WA Enterprise", callback_data: "sel_meta_6" }],
                            [{ text: "7️⃣ Omnichannel Starter", callback_data: "sel_meta_7" }],
                            [{ text: "8️⃣ Omnichannel Growth", callback_data: "sel_meta_8" }],
                            [{ text: "9️⃣ Omnichannel Pro", callback_data: "sel_meta_9" }]
                        ]
                    }
                };
            }

            return sendUnifiedMessage(from, menu8Text, platform, tgOptions);
        }
    }
}

async function finalizeConsultationLead(from, textInput, res, platform) {
    const session = userSessions[from];
    const cleanName = session.clientName || "Valued Client";
    const clientEmail = session.clientEmail || "Not Provided";
    const dynamicSlot = session.requestedSlot || "Direct Scheduled Request";
    const userLang = session.lang;

    const displayPhone = session.clientPhone || (platform === 'whatsapp' ? from : "Not Provided");

    const isUSDTrack = (userLang === 'EN'); 
    const matchedBasePriceStr = getBasePriceByPlan(textInput, isUSDTrack);
    const matchedBasePrice = parseFloat(matchedBasePriceStr);
    
    const savingAmount = Math.round(matchedBasePrice * 0.20);
    const discountedBasePrice = matchedBasePrice - savingAmount;
    const finalCalculatedPrice = calculateTotalPayable(discountedBasePrice, isUSDTrack);
    
    const currency = isUSDTrack ? '$' : '₹';
    const taxLabel = isUSDTrack ? 'incl Gateway Fees' : 'incl GST';

    let apptTimestamp = null;
    const dateObjCons = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Kolkata"}));
    let inputStr = dynamicSlot.toLowerCase();

    if (inputStr.includes('tomorrow') || inputStr.includes('kal')) {
        dateObjCons.setDate(dateObjCons.getDate() + 1);
    } else if (inputStr.includes('day after') || inputStr.includes('parso')) {
        dateObjCons.setDate(dateObjCons.getDate() + 2);
    }

    let h = 0, m = 0, isValidTimeFound = false;
    
    if (inputStr.includes("today at 5:00 pm") || inputStr.includes("aaj shaam 5:00 baje")) {
        h = 17; m = 0; isValidTimeFound = true;
    } else if (inputStr.includes("tomorrow at 5:00 pm") || inputStr.includes("kal shaam 5:00 baje")) {
        h = 17; m = 0; isValidTimeFound = true;
        dateObjCons.setDate(new Date().getDate() + 1);
    } else if (inputStr.includes("tomorrow at 12:00 pm") || inputStr.includes("kal dopahar 12:00 baje")) {
        h = 12; m = 0; isValidTimeFound = true;
        dateObjCons.setDate(new Date().getDate() + 1);
    } else if (inputStr.includes("day after tomorrow at 12:00 pm") || inputStr.includes("parso dopahar 12:00 baje")) {
        h = 12; m = 0; isValidTimeFound = true;
        dateObjCons.setDate(new Date().getDate() + 2);
    } else {
        const timeMatch = dynamicSlot.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM|am|pm|baje)/i);
        if (timeMatch) {
            h = parseInt(timeMatch[1], 10);
            m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            let mod = timeMatch[3].toLowerCase();

            if ((mod === 'pm' || mod === 'baje') && h < 12 && h >= 1 && h <= 5) h += 12;
            if (mod === 'am' && h === 12) h = 0;
            isValidTimeFound = true;
        } else {
            if (inputStr.includes("5pm") || inputStr.includes("5 pm") || inputStr.includes("5 baje")) { h = 17; m = 0; isValidTimeFound = true; }
            else if (inputStr.includes("4pm") || inputStr.includes("4 pm") || inputStr.includes("4 baje")) { h = 16; m = 0; isValidTimeFound = true; }
            else if (inputStr.includes("3pm") || inputStr.includes("3 pm") || inputStr.includes("3 baje")) { h = 15; m = 0; isValidTimeFound = true; }
            else if (inputStr.includes("2pm") || inputStr.includes("2 pm") || inputStr.includes("2 baje")) { h = 14; m = 0; isValidTimeFound = true; }
            else if (inputStr.includes("1pm") || inputStr.includes("1 pm") || inputStr.includes("1 baje")) { h = 13; m = 0; isValidTimeFound = true; }
            else if (inputStr.includes("12pm") || inputStr.includes("12 pm") || inputStr.includes("12 baje")) { h = 12; m = 0; isValidTimeFound = true; }
            else if (inputStr.includes("11am") || inputStr.includes("11 am") || inputStr.includes("11 baje")) { h = 11; m = 0; isValidTimeFound = true; }
        }
    }

    if (isValidTimeFound) {
        dateObjCons.setHours(h, m, 0, 0);
        apptTimestamp = dateObjCons.getTime();
    }

    if (!isValidTimeFound || !apptTimestamp) {
        let errMsg = userLang === 'EN' 
            ? "⚠️ *Invalid Time Format!*\nPlease specify a valid time between 11 AM and 5 PM (e.g., *Tomorrow at 2 PM*)." 
            : "⚠️ *Galat Samay!*\nKripya 11 AM se 5 PM ke beech ka sahi samay likhein (jaise: *Kal 2 PM*).";
        userSessions[from].step = 'awaiting_custom_time_input';
        return sendUnifiedMessage(from, errMsg, platform);
    }

    const d = new Date(apptTimestamp);
    
    if (apptTimestamp <= Date.now()) {
        let pastMsg = userLang === 'EN' 
            ? "⚠️ *Past Time Selected!*\nPlease select a future time for your consultation." 
            : "⚠️ *Guzra Hua Samay!*\nKripya aane wale samay ka chunaaw karein.";
        userSessions[from].step = 'awaiting_custom_time_input';
        return sendUnifiedMessage(from, pastMsg, platform);
    }

    if (d.getDay() === 5) {
        let friMsg = userLang === 'EN' 
            ? "⚠️ *Friday is Off!*\nOur team does not take consultations on Fridays. Please reply with another Date and Time (e.g., *Monday at 2 PM*)." 
            : "⚠️ *Friday Off!*\nHumari team Friday ko consultation nahi leti hai. Kripya koi dusra din aur samay likhein (jaise: *Monday 2 PM*).";
        userSessions[from].step = 'awaiting_custom_time_input';
        return sendUnifiedMessage(from, friMsg, platform);
    }
    
    const hr = d.getHours();
    if (hr < 11 || hr > 17 || (hr === 17 && d.getMinutes() > 0)) {
        let timeMsg = userLang === 'EN' 
            ? "⚠️ *Outside Hours!*\nConsultation hours are strictly *11:00 AM to 5:00 PM*. Please reply with a valid time within this window." 
            : "⚠️ *Samay Seema se Bahar!*\nConsultation ka samay subah *11 AM se shaam 5 PM* tak hai. Kripya iske beech ka koi samay likhein.";
        userSessions[from].step = 'awaiting_custom_time_input';
        return sendUnifiedMessage(from, timeMsg, platform);
    }
    
    const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}_${hr}`;
    if (bookedSlots.consultation_hourly[dateKey] >= 2) {
        let fullMsg = userLang === 'EN' 
            ? "⚠️ *Slot Unavailable!*\nThis hour is fully booked (Max 2 slots/hr). Please reply with another time." 
            : "⚠️ *Slot Unavailable!*\nYe ghanta pehle hi full ho chuka hai (Max 2 bookings). Kripya koi aur samay likhein.";
        userSessions[from].step = 'awaiting_custom_time_input';
        return sendUnifiedMessage(from, fullMsg, platform);
    }

    bookedSlots.consultation_hourly[dateKey] = (bookedSlots.consultation_hourly[dateKey] || 0) + 1;

    const diffMs = apptTimestamp - Date.now();
    const diffHoursInitial = diffMs / (1000 * 60 * 60);
    
    activeAppointments.push({
        bot: 'consultation',
        platform: platform,
        chatId: from,
        lang: userLang,
        timestamp: apptTimestamp,
        clientName: cleanName,
        reminded: { 
            '10': diffHoursInitial <= 10,
            '3': diffHoursInitial <= 3, 
            '2': diffHoursInitial <= 2,   
            '1': diffHoursInitial <= 1    
        }
    });

    const optionsDate = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' };
    let displayAdminDate = new Date(apptTimestamp).toLocaleString('en-IN', optionsDate);

    const comprehensiveAdminAlert = `🚨 *PRE-QUALIFIED B2B CONSULTATION LEAD!* 🚨\n\n📱 *Client Contact:* ${displayPhone} ${platform === 'telegram' ? '(Telegram)' : '(WhatsApp)'}\n💬 *Telegram Chat ID:* ${platform === 'telegram' ? from : 'N/A'}\n👤 *Name:* ${cleanName}\n✉️ *Email:* ${clientEmail}\n📝 *Slot Details:* ${displayAdminDate} (Input: ${dynamicSlot})\n💬 *User Stated Objectives:* "${textInput}"\n💵 *Base Price:* ${currency}${matchedBasePrice}\n🔥 *Discount Applied:* ${currency}${savingAmount} (11VI20)\n💰 *Calculated Price:* ${currency}${finalCalculatedPrice} (${taxLabel})\n\n🤖 *Status:* Live details captured securely!`;
    
    const WHATSAPP_ADMIN_NUMBER = process.env.WHATSAPP_ADMIN_NUMBER || "917529839762";
    sendWhatsAppMessage(WHATSAPP_ADMIN_NUMBER, comprehensiveAdminAlert);
    
    const TELEGRAM_ADMIN_ID = ADMIN_CHAT_ID; 
    try {
        let htmlText = comprehensiveAdminAlert
            .replace(/\*(.*?)\*/g, '<b>$1</b>')
            .replace(/_(.*?)_/g, '<i>$1</i>');
        
        bot.sendMessage(TELEGRAM_ADMIN_ID, htmlText, { 
            parse_mode: "HTML",
            reply_markup: {
                inline_keyboard: [
                    [{ text: "✅ Confirm Booking", callback_data: `admin_cons_confirm_${from}` }],
                    [{ text: "🔄 Reschedule / Msg Client", callback_data: `admin_cons_resched_${from}` }]
                ]
            }
        });
    } catch (e) {
        console.error("Telegram Admin Alert Error", e.message);
    }

    const targetEndpoint = 'https://shahidcreatives.com/api/whatsapp-leads';

    try {
        await axios.post(targetEndpoint, {
            client_name: cleanName,
            whatsapp_number: displayPhone,
            telegram_chat_id: platform === 'telegram' ? from : undefined,
            email: clientEmail,
            requested_slot: dynamicSlot,
            discussion_notes: `*User Stated Objectives:* "${textInput}"\n\n${comprehensiveAdminAlert}`, 
            project_scope: textInput, 
            calculated_price: finalCalculatedPrice,
            coupon_code: "11VI20"
        });
    } catch (apiErr) { console.error("Dashboard parameters execution failure handler."); }

    let confirmationText = (userLang === 'EN')
        ? `✅ *Booking Request Sent!* \n\nThank you *${cleanName}*! Your strategy slot request for *${displayAdminDate}* is pending admin approval. You will receive a confirmation shortly! 🚀\n\n🌐 _Powered by Shahid Creatives_`
        : `✅ *Booking Request Sent!* \n\nThank you *${cleanName}*! Aapka strategy slot (*${displayAdminDate}*) admin approval ke liye bheja gaya hai. Aapko jald hi confirmation mil jayegi! 🚀\n\n🌐 _Powered by Shahid Creatives_`;
    return sendUnifiedMessage(from, confirmationText, platform);
}

async function sendUnifiedMessage(to, text, platform, options = null) {
    if (platform === 'telegram') {
        try {
            let htmlText = text
                .replace(/\*(.*?)\*/g, '<b>$1</b>')
                .replace(/_(.*?)_/g, '<i>$1</i>');
                
            let tgOptions = { parse_mode: "HTML" };
            if (options && options.reply_markup) {
                tgOptions.reply_markup = options.reply_markup;
            }
                
            await bot.sendMessage(to, htmlText, tgOptions);
        } catch (e) {
            await bot.sendMessage(to, text).catch(()=>{}); 
        }
    } else {
        await sendWhatsAppMessage(to, text);
    }
}

async function sendAdminAlert(text) {
    const WHATSAPP_ADMIN_NUMBER = process.env.WHATSAPP_ADMIN_NUMBER || "917529839762";
    await sendWhatsAppMessage(WHATSAPP_ADMIN_NUMBER, text);
    
    const TELEGRAM_ADMIN_ID = ADMIN_CHAT_ID; 
    try {
        let htmlText = text
            .replace(/\*(.*?)\*/g, '<b>$1</b>')
            .replace(/_(.*?)_/g, '<i>$1</i>');
        await bot.sendMessage(TELEGRAM_ADMIN_ID, htmlText, { parse_mode: "HTML" });
    } catch (e) {
        bot.sendMessage(TELEGRAM_ADMIN_ID, text).catch(err => {});
    }
}

async function sendWhatsAppMessage(to, text) {
    const SECURED_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "EAAOT5XBXyVwBR7v5XwYnbITF4zF3xWzQXikBjAH1w2qu0sQTbVkyqpNvmRAqhkmU7BqCEcthw5CHelfzr3fmDF2C3la6lw28iYLPI3EmZAZC6vDQoHQyiZAKz7QmfuiZBh0TKhusnrH6CeJZBJLdwU30MOzyr7Vkn26w5dE4md74Bu4OwoLzqfmCCtFDZA9AZDZD"; 
    const DEFAULT_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1202984902891472"; 
    try {
        await axios({
            method: "POST", 
            url: `https://graph.facebook.com/v18.0/${DEFAULT_PHONE_NUMBER_ID}/messages`,
            data: { messaging_product: "whatsapp", to: to, type: "text", text: { body: text } },
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECURED_ACCESS_TOKEN}` }
        });
    } catch (e) { }
} 

const PORT = process.env.PORT || 10000; 
app.listen(PORT, '0.0.0.0', () => {
    console.log(`ChatBot engine live on port ${PORT}`);
    console.log("✅ Original Telegram Bot Active!");
    console.log("✅ Salon Telegram Bot Active!");
    console.log("✅ Zam Zam Clinic Bot Active!");
    console.log("✅ WhatsApp Webhook Active!");
});
