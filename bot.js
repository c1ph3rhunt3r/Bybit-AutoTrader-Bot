require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const BybitClient = require('./bybit_client');
const { Sequelize, DataTypes } = require('sequelize');

// Initialize PostgreSQL connection using Sequelize
const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
});

const TradeLog = sequelize.define('TradeLog', {
    symbol: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    side: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    timestamp: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    },
});

// Initialize the Telegram bot
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Initialize Bybit client
const bybitClient = new BybitClient(process.env.BYBIT_API_KEY, process.env.BYBIT_API_SECRET);

let currentMode = "Manual";  // Default mode
let selectedGroups = [];  // To store the selected group IDs and admin IDs
let botStartTime = Date.now();  // Store the bot's start time

// Utility function to get the user ID from the .env file as a string for comparison
function getUserId() {
    const userId = process.env.USER_ID;
    if (!userId) {
        throw new Error("USER_ID is not set in the environment variables");
    }
    return userId.toString();
}

// Start command handler
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;

    // Check if the command is used in a group or supergroup
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
        if (msg.from.id.toString() === getUserId()) {
            currentMode = "Signal";
            selectedGroups.push({ id: chatId, adminId: msg.from.id });
            await bot.sendMessage(chatId, "Signal mode enabled.");
            await bot.sendMessage(getUserId(), `Signal mode enabled for group: ${msg.chat.title}`);
        } else {
            await bot.sendMessage(chatId, `You do not have permission to control this bot. Your id is ${msg.from.id}`);
        }
    } else {
        // For DMs, allow the user to choose the mode
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Manual Mode', callback_data: 'manual' }],
                    [{ text: 'Signal Mode', callback_data: 'signal' }]
                ]
            }
        };
        await bot.sendMessage(chatId, 'Welcome to the Automated Trading Bot by c1ph3rhunt3r! Choose your mode:', opts);
    }
});

// Exit mode command handler
bot.onText(/\/exitmode/, async (msg) => {
    currentMode = "Manual";  // Reset to Manual mode
    selectedGroups = [];  // Reset selected groups
    await sendHomeMessage(getUserId());  // Always redirect user to DM
});

// Help command handler
bot.onText(/\/help/, async (msg) => {
    const helpMessage = `
Available Commands:
/start - Start the bot and choose a mode
/exitmode - Exit the current mode and return to the home screen
/help - Display this help message
`;
    await bot.sendMessage(msg.chat.id, helpMessage);
});

// Mode selection handler
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const mode = callbackQuery.data;

    if (mode === 'signal') {
        currentMode = 'Signal';
        await bot.editMessageText('Signal Mode activated. Scanning for groups...', {
            chat_id: message.chat.id,
            message_id: message.message_id,
        });

        // Get all groups the bot is a member of
        const groups = await getBotGroups();
        if (groups.length === 0) {
            await bot.sendMessage(getUserId(), 'No groups found. Please add the bot to a group first. If this is a false report, run the command /start in the group I missed');
            return;
        }

        // Prompt the user to select groups
        const groupOptions = groups.map(group => [{ text: group.title, callback_data: `group_${group.id}` }]);
        await bot.sendMessage(getUserId(), 'Select the groups to listen to signals from (you can select multiple):', {
            reply_markup: { inline_keyboard: groupOptions }
        });

    } else {
        currentMode = 'Manual';
        await bot.editMessageText('Manual Mode activated.', {
            chat_id: message.chat.id,
            message_id: message.message_id,
        });
    }
});

// Group selection handler
bot.on('callback_query', async (callbackQuery) => {
    if (callbackQuery.data.startsWith('group_')) {
        const groupId = callbackQuery.data.split('_')[1];
        const botAdminId = await getGroupAdminId(groupId);

        if (selectedGroups.some(group => group.id === groupId)) {
            await bot.sendMessage(getUserId(), `Group (ID: ${groupId}) is already selected.`);
        } else {
            selectedGroups.push({ id: groupId, adminId: botAdminId });
            await bot.sendMessage(getUserId(), `Group (ID: ${groupId}) selected.`);
        }
    }
});

// Listen to signals in selected groups
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (msg.date * 1000 < botStartTime) {
        // Ignore messages that were sent before the bot started
        return;
    }

    if (msg.text && msg.text.startsWith('/start') && (msg.chat.type === 'group' || msg.chat.type === 'supergroup')) {
        return; // Prevent interpreting /start as a signal in groups
    }

    if (currentMode === 'Signal') {
        const selectedGroup = selectedGroups.find(group => group.id.toString() === chatId.toString());
        if (selectedGroup && msg.from.id === selectedGroup.adminId) {
            await handleSignalMessage(msg);
        }
    } else if (currentMode === 'Manual') {
        if (msg.text.startsWith('/start') || msg.text.startsWith('/exitmode') || msg.text.startsWith('/help')) {
            return;  // Ignore the /start, /exitmode, and /help commands in the message handler
        }

        try {
            await handleManualTrade(msg.text, chatId);
        } catch (error) {
            console.error('Error executing trade:', error.message);
            await bot.sendMessage(chatId, `Error executing trade: ${error.message}`);
        }
    }
});

// Function to scan and detect all groups the bot is a member of
async function getBotGroups() {
    const updates = await bot.getUpdates();
    const groups = [];

    for (const update of updates) {
        if (update.message && (update.message.chat.type === 'group' || update.message.chat.type === 'supergroup')) {
            if (!groups.find(group => group.id === update.message.chat.id)) {
                groups.push({
                    id: update.message.chat.id,
                    title: update.message.chat.title,
                });
            }
        }
    }
    return groups;
}

// Function to get the admin ID of a group
async function getGroupAdminId(groupId) {
    const admins = await bot.getChatAdministrators(groupId);
    const botAdmin = admins.find(admin => admin.user.id === bot.id);
    return botAdmin ? botAdmin.user.id : null;
}

// Handle signal message in the group
async function handleSignalMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (msg.text && msg.text === '' && !msg.forward_date) {
        // Ignore deleted or empty messages
        return;
    }

    // Parse and handle the signal
    try {
        const [symbol, side, entry, sl, tps, leverage, quantity] = await parseTradeSignal(text);

        if (!symbol || !side || !entry || !sl || !tps.length || !leverage || !quantity) {
            throw new Error('Incomplete trade signal information');
        }

        await bot.sendMessage(getUserId(), `Detected signal: ${text}`);
        await handleSignalTrade(text, getUserId());
    } catch (error) {
        console.error('Error processing signal:', error.message);
        await bot.sendMessage(getUserId(), `Error processing signal: ${error.message}`);
    }
}

// Parse trade signal
function parseTradeSignal(text) {
    const lines = text.split('\n');
    const symbolSide = lines[0].trim();
    const symbolMatch = symbolSide.match(/(\w+)\s*\((LONG|SHORT)\)/);

    if (!symbolMatch) return [null, null, null, null, [], null, null];

    const symbol = symbolMatch[1];
    const side = symbolMatch[2] === 'LONG' ? 'Buy' : 'Sell';
    let entry, sl, leverage;
    let tps = [];
    let quantity = 0.25; // Default to 25% if not specified

    for (const line of lines.slice(1)) {
        if (line.startsWith('Entry:')) entry = parseFloat(line.split(':')[1].trim());
        if (line.startsWith('SL:')) sl = parseFloat(line.split(':')[1].trim());
        if (line.startsWith('TP')) tps.push(parseFloat(line.split(':')[1].trim()));
        if (line.startsWith('Leverage:')) leverage = parseInt(line.match(/Leverage:\s*(\d+)x/)[1]);
        if (line.startsWith('Quantity:')) {
            const quantityStr = line.split(':')[1].trim();
            if (quantityStr.includes('%')) {
                const percentage = parseFloat(quantityStr.replace('%', '').trim());
                quantity = calculateQuantityFromPercentage(symbol, percentage);
            } else {
                quantity = parseFloat(quantityStr);
            }
        }
    }

    leverage = leverage || 10;  // Default to 10x
    if (!tps.length) tps = [entry];
    return [symbol, side, entry, sl, tps, leverage, quantity];
}

// Calculate quantity based on percentage
async function calculateQuantityFromPercentage(symbol, percentage) {
    const asset = symbol.split('USDT')[0]; // Assuming the asset is the base currency (e.g., BTC from BTCUSDT)
    const balances = await bybitClient.getBalance([asset, 'USDT']);
    const balance = balances[asset];
    return (percentage / 100) * balance;
}

// Handle signal trade
async function handleSignalTrade(text, chatId) {
    const [symbol, side, entry, sl, tps, leverage, quantity] = await parseTradeSignal(text);

    if (!symbol || !side || !entry || !sl || !tps.length || !leverage || !quantity) {
        throw new Error('Incomplete trade signal information');
    }

    // Check for balance before placing the trade
    const asset = symbol.split('USDT')[0];
    const balances = await bybitClient.getBalance([asset, 'USDT']);
    const balance = balances[asset];

    if (!balance || balance < quantity) {
        await bot.sendMessage(chatId, `Insufficient balance (${balance}) to execute trade.`);
        await sendHomeMessage(chatId);
        return;
    }

    // Execute the trade
    await executeTrade(text, chatId);
}

// Handle manual trade
async function handleManualTrade(text, chatId) {
    const [symbol, side, entry, sl, tps, leverage, quantity] = await parseTradeSignal(text);

    if (!symbol || !leverage || !quantity) {
        throw new Error('Incomplete manual trade information');
    }

    // Check for balance before placing the trade
    const asset = symbol.split('USDT')[0];
    const balances = await bybitClient.getBalance([asset, 'USDT']);
    const balance = balances[asset];

    if (!balance || balance < quantity) {
        await bot.sendMessage(chatId, `Insufficient balance (${balance}) to execute trade.`);
        await sendHomeMessage(chatId);
        return;
    }

    // Execute the trade
    await executeTrade(text, chatId);
}

// Execute the trade
async function executeTrade(text, chatId) {
    const [symbol, side, entry, sl, tps, leverage, quantity] = await parseTradeSignal(text);

    for (const tp of tps) {
        // Pre-execution balance recheck
        const asset = symbol.split('USDT')[0];
        const balances = await bybitClient.getBalance([asset, 'USDT']);
        const balance = balances[asset];

        if (!balance || balance < quantity) {
            await bot.sendMessage(chatId, `Balance changed. Insufficient balance (${balance}) to complete the trade.`);
            await sendHomeMessage(chatId);
            return;
        }

        const params = {
            symbol,
            side,
            qty: quantity,
            price: tp,
            time_in_force: 'GoodTillCancel',
            reduce_only: false,
            close_on_trigger: false,
            leverage,
            order_type: 'Limit',
            position_idx: 0,
        };

        try {
            const response = await bybitClient.placeActiveOrder(params);
            await bot.sendMessage(chatId, `Trade placed: ${side} ${symbol} with TP: ${tp}, SL: ${sl}, Leverage: ${leverage}x, Quantity: ${quantity}`);
        } catch (error) {
            await bot.sendMessage(chatId, `Error placing trade: ${error.message}`);
        }
    }
}

// Send the user back to the home/start screen
async function sendHomeMessage(chatId) {
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Manual Mode', callback_data: 'manual' }],
                [{ text: 'Signal Mode', callback_data: 'signal' }]
            ]
        }
    };
    await bot.sendMessage(chatId, 'Redirecting to home. Ignore this message if you want Signal mode to keep running in group. Please choose your mode:', opts);
}

// Connect to the database and start the bot
(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connection to the PostgreSQL database has been established successfully.');
        await TradeLog.sync();
        console.log('TradeLog table has been synchronized.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
})();
