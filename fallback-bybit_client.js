const axios = require('axios');
const crypto = require('crypto');
const querystring = require('querystring');

class BybitClient {
    constructor(apiKey, apiSecret) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.baseUrl = 'https://api.bybit.com';
    }

    generateSignature(params) {
        // Sort the parameters by key in alphabetical order
        const orderedParams = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');

        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(orderedParams)
            .digest('hex');
    }

    async request(endpoint, method = 'GET', params = {}, isPrivate = false) {
        const url = `${this.baseUrl}/${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
        };

        if (isPrivate) {
            params.api_key = this.apiKey;
            params.timestamp = Date.now();
            params.recv_window = 10000;  // Optional: Adjust according to your needs
            params.sign = this.generateSignature(params);
        }

        try {
            console.log(`Making ${method} request to ${url} with params:`, params);

            // URL encode the params
            const queryString = querystring.stringify(params);

            const response = await axios({
                url: method === 'GET' ? `${url}?${queryString}` : url,
                method,
                headers,
                data: method === 'POST' ? params : undefined,
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                console.error('API Request Error:', error.response.status, error.response.data);
            } else {
                console.error('API Request Error:', error.message);
            }
            throw new Error(error.response ? error.response.data.ret_msg || JSON.stringify(error.response.data) : 'API request failed');
        }
    }

    // Public endpoints
    async getSymbols() {
        return await this.request('v5/market/instruments-info', 'GET');
    }

    async getServerTime() {
        return await this.request('v5/public/time', 'GET');
    }

    // Private endpoints
    async getWalletBalance(params) {
        return await this.request('v5/account/wallet-balance', 'GET', params, true);
    }

    async placeActiveOrder(params) {
        return await this.request('v5/order/create', 'POST', params, true);
    }

    async cancelActiveOrder(params) {
        return await this.request('v5/order/cancel', 'POST', params, true);
    }

    async getActiveOrderList(params) {
        return await this.request('v5/order/list', 'GET', params, true);
    }

    // New method to get balance for specific assets
    async getBalance(assets) {
        try {
            const params = {
                coin: assets.join(','),
                accountType: 'UNIFIED',
            };
            const response = await this.getWalletBalance(params);

            // Log the full response for debugging
            console.log('API Response:', JSON.stringify(response, null, 2));

            if (response && response.result && response.result.list && response.result.list.length > 0) {
                const balanceInfo = response.result.list[0].coin.reduce((acc, coinData) => {
                    if (assets.includes(coinData.coin)) {
                        acc[coinData.coin] = parseFloat(coinData.walletBalance);
                    }
                    return acc;
                }, {});

                return balanceInfo;
            } else {
                console.error('Unexpected response structure:', response);
                throw new Error('Failed to retrieve wallet balance');
            }
        } catch (error) {
            console.error('Error fetching balance:', error.message);
            throw error;
        }
    }
}

module.exports = BybitClient;
