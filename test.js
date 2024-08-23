const axios = require('axios');

async function testBybitConnection() {
    const apiKey = process.env.BYBIT_API_KEY;
    const baseURL = 'https://api.bybit.com';  // Or 'https://api-testnet.bybit.com' for testnet

    try {
        const response = await axios.get(`${baseURL}/v2/public/time`, {
            headers: {
                'X-BYBIT-API-KEY': apiKey
            }
        });
        console.log('Connection successful, server time:', response.data);
    } catch (error) {
        console.error('Error connecting to Bybit API:', error.response ? error.response.data : error.message);
    }
}

testBybitConnection();
