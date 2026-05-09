const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { optionalAuth } = require('../middleware/auth');
const { getOrderById, updateOrderStatus } = require('../lib/storage');

const router = express.Router();

const envValue = (key, fallback = '') => (process.env[key] || fallback).trim();

// M-Pesa Configuration
const MPESA_CONFIG = {
    consumerKey: envValue('MPESA_CONSUMER_KEY'),
    consumerSecret: envValue('MPESA_CONSUMER_SECRET'),
    passkey: envValue('MPESA_PASSKEY'),
    shortcode: envValue('MPESA_SHORTCODE', '174379'),
    callbackUrl: envValue('MPESA_CALLBACK_URL', 'https://yourdomain.com/api/mpesa/callback'),
    environment: envValue('MPESA_ENVIRONMENT', 'sandbox'),
};

// Get API URLs based on environment
const getApiUrls = () => {
    const isSandbox = MPESA_CONFIG.environment === 'sandbox';
    return {
        oauth: isSandbox 
            ? 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
            : 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: isSandbox
            ? 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
            : 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    };
};

const mpesaTransactionsPath = path.join(__dirname, '..', 'data', 'mpesa_transactions.json');

// Helper functions
const readMpesaTransactions = () => {
    try {
        const data = fs.readFileSync(mpesaTransactionsPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
};

const writeMpesaTransactions = (transactions) => {
    fs.writeFileSync(mpesaTransactionsPath, JSON.stringify(transactions, null, 2));
};

// Get M-Pesa OAuth token
const getMpesaToken = async () => {
    try {
        if (!MPESA_CONFIG.consumerKey || !MPESA_CONFIG.consumerSecret) {
            throw new Error('M-Pesa credentials not configured');
        }

        const auth = Buffer.from(
            `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`
        ).toString('base64');

        const urls = getApiUrls();
        const response = await axios.get(urls.oauth, {
            headers: {
                Authorization: `Basic ${auth}`
            }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('M-Pesa token error:', error.message);
        throw new Error('Failed to get M-Pesa token');
    }
};

// Generate password for STK push
const generatePassword = () => {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(
        `${MPESA_CONFIG.shortcode}${MPESA_CONFIG.passkey}${timestamp}`
    ).toString('base64');
    return { password, timestamp };
};

const sameId = (a, b) => String(a) === String(b);

const normalizePhone = (phoneNumber) => {
    const formattedPhone = String(phoneNumber || '').replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) return '254' + formattedPhone.substring(1);
    if (formattedPhone.startsWith('254')) return formattedPhone;
    return null;
};

const phoneMatches = (left, right) => {
    const leftPhone = normalizePhone(left);
    const rightPhone = normalizePhone(right);
    return !!leftPhone && !!rightPhone && leftPhone === rightPhone;
};

// Initiate STK Push (Lipa na M-Pesa Online)
router.post('/stkpush', optionalAuth, async (req, res) => {
    try {
        const { orderId, phoneNumber, amount } = req.body;

        // Validation
        if (!orderId || !phoneNumber || !amount) {
            return res.status(400).json({ 
                error: 'Order ID, phone number, and amount are required' 
            });
        }

        const formattedPhone = normalizePhone(phoneNumber);
        if (!formattedPhone) {
            return res.status(400).json({ 
                error: 'Invalid phone number format. Use 07XXXXXXXX or 2547XXXXXXXX' 
            });
        }

        // Validate order
        const order = await getOrderById(orderId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const ownsOrder = req.user && (sameId(order.userId, req.user.id) || req.user.isAdmin);
        const guestMatchesOrder = order.isGuestOrder && phoneMatches(order.customerPhone, phoneNumber);
        if (!ownsOrder && !guestMatchesOrder) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (order.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Order already paid' });
        }

        // Check if M-Pesa is configured
        if (!MPESA_CONFIG.consumerKey || !MPESA_CONFIG.consumerSecret || !MPESA_CONFIG.passkey) {
            return res.status(503).json({ 
                error: 'M-Pesa payment is not configured. Please contact administrator.',
                configured: false
            });
        }

        // Get access token
        const token = await getMpesaToken();

        // Generate password and timestamp
        const { password, timestamp } = generatePassword();

        // Prepare STK push request
        const urls = getApiUrls();
        const stkPushData = {
            BusinessShortCode: MPESA_CONFIG.shortcode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.ceil(order.totalAmount || amount),
            PartyA: formattedPhone,
            PartyB: MPESA_CONFIG.shortcode,
            PhoneNumber: formattedPhone,
            CallBackURL: MPESA_CONFIG.callbackUrl,
            AccountReference: order.orderNumber,
            TransactionDesc: `Payment for order ${order.orderNumber}`
        };

        // Send STK push
        const response = await axios.post(urls.stkPush, stkPushData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Save transaction record
        const transactions = readMpesaTransactions();
        const newTransaction = {
            id: transactions.length > 0 ? Math.max(...transactions.map(t => t.id)) + 1 : 1,
            orderId,
            merchantRequestId: response.data.MerchantRequestID,
            checkoutRequestId: response.data.CheckoutRequestID,
            responseCode: response.data.ResponseCode,
            responseDescription: response.data.ResponseDescription,
            customerMessage: response.data.CustomerMessage,
            phoneNumber: formattedPhone,
            amount: Math.ceil(order.totalAmount || amount),
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        transactions.push(newTransaction);
        writeMpesaTransactions(transactions);

        await updateOrderStatus(order.id, {
            paymentStatus: 'pending',
            paymentReference: response.data.CheckoutRequestID,
            status: order.status || 'pending'
        });

        res.json({
            success: true,
            message: 'STK push sent. Please check your phone.',
            checkoutRequestId: response.data.CheckoutRequestID,
            customerMessage: response.data.CustomerMessage
        });

    } catch (error) {
        console.error('STK Push error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to initiate payment',
            details: error.response?.data?.errorMessage || error.message
        });
    }
});

// M-Pesa callback (receives payment confirmation from Safaricom)
router.post('/callback', async (req, res) => {
    try {
        console.log('M-Pesa Callback received:', JSON.stringify(req.body, null, 2));

        const { Body } = req.body;
        const { stkCallback } = Body;

        const transactions = readMpesaTransactions();
        const transaction = transactions.find(
            t => t.checkoutRequestId === stkCallback.CheckoutRequestID
        );

        if (!transaction) {
            console.error('Transaction not found for callback');
            return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
        }

        // Update transaction status
        const transactionIndex = transactions.findIndex(
            t => t.checkoutRequestId === stkCallback.CheckoutRequestID
        );

        transactions[transactionIndex].resultCode = stkCallback.ResultCode;
        transactions[transactionIndex].resultDesc = stkCallback.ResultDesc;

        if (stkCallback.ResultCode === 0) {
            // Payment successful
            const metadata = stkCallback.CallbackMetadata.Item;
            const amount = metadata.find(item => item.Name === 'Amount')?.Value;
            const mpesaReceiptNumber = metadata.find(item => item.Name === 'MpesaReceiptNumber')?.Value;
            const transactionDate = metadata.find(item => item.Name === 'TransactionDate')?.Value;
            const phoneNumber = metadata.find(item => item.Name === 'PhoneNumber')?.Value;

            transactions[transactionIndex].status = 'completed';
            transactions[transactionIndex].mpesaReceiptNumber = mpesaReceiptNumber;
            transactions[transactionIndex].transactionDate = transactionDate;
            transactions[transactionIndex].phoneNumber = phoneNumber;
            transactions[transactionIndex].amount = amount;

            await updateOrderStatus(transaction.orderId, {
                paymentStatus: 'paid',
                paymentReference: mpesaReceiptNumber,
                status: 'confirmed'
            });
        } else {
            // Payment failed
            transactions[transactionIndex].status = 'failed';

            await updateOrderStatus(transaction.orderId, { paymentStatus: 'failed' });
        }

        writeMpesaTransactions(transactions);

        res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    } catch (error) {
        console.error('Callback processing error:', error);
        res.json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
    }
});

// Check payment status
router.get('/status/:checkoutRequestId', optionalAuth, async (req, res) => {
    try {
        const transactions = readMpesaTransactions();
        const transaction = transactions.find(
            t => t.checkoutRequestId === req.params.checkoutRequestId
        );

        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }

        // Check if user owns this transaction
        const order = await getOrderById(transaction.orderId);

        if (order && req.user && !sameId(order.userId, req.user.id) && !req.user.isAdmin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ transaction });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

// Get M-Pesa configuration status (public)
router.get('/config-status', (req, res) => {
    const isConfigured = !!(
        MPESA_CONFIG.consumerKey && 
        MPESA_CONFIG.consumerSecret && 
        MPESA_CONFIG.passkey
    );

    res.json({
        configured: isConfigured,
        environment: MPESA_CONFIG.environment,
        message: isConfigured 
            ? 'M-Pesa is configured and ready' 
            : 'M-Pesa is not configured. Contact administrator.'
    });
});

module.exports = router;
