import express from 'express';
import axios from "axios";
import cors from 'cors';
import { randomUUID } from 'crypto';

const server = express();
server.use(express.json({limit: '50mb'}));
server.use(cors());

// Base axios instance
const pawapayClient = axios.create({
    baseURL: 'https://api.sandbox.pawapay.cloud',
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PAWAPAY_API_TOKEN}`,
    },
});

// Malawi defaults
const DEFAULT_CURRENCY = 'MWK';
const DEFAULT_COUNTRY = 'MWI';
const CORRESPONDENTS = {
    AIRTEL: 'AIRTEL_OAPI_MWI',
    TNM: 'TNM_MPAMBA_MWI',
};

// ==========================================
// HEALTH CHECK
// ==========================================
server.get('/', (_req, res) => {
    res.json({
        message: 'Welcome to Malawi Payment API 🇲🇼🚀',
        error: false,
        country: 'Malawi',
        currency: DEFAULT_CURRENCY,
        correspondents: CORRESPONDENTS,
    });
});

// ==========================================
// WIDGET SESSION
// ==========================================
server.post('/payments/initiate', async (req, res) => {
    const { depositId, amount } = req.body;

    if (!depositId || !amount) {
        return res.status(400).json({
            error: true,
            message: 'Invalid request. depositId and amount are required',
        });
    }

    try {
        const response = await pawapayClient.post('/v1/widget/sessions', {
            depositId,
            amount,
            currency: DEFAULT_CURRENCY,
            country: DEFAULT_COUNTRY,
            returnUrl: process.env.RETURN_URL,
        });

        const { redirectUrl } = response.data;

        return res.status(200).json({
            error: false,
            redirectUrl,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// ==========================================
// DEPOSITS
// ==========================================

// Initiate a deposit
server.post('/deposits/initiate', async (req, res) => {
    const {
        amount,
        address,
        correspondent,
        customerTimestamp,
        statementDescription
    } = req.body;

    if (!amount || !address || !correspondent) {
        return res.status(400).json({
            error: true,
            message: 'amount, address and correspondent are required. Use AIRTEL_OAPI_MWI or TNM_MPAMBA_MWI',
        });
    }

    // Validate Malawi phone number
    if (!address.startsWith('265')) {
        return res.status(400).json({
            error: true,
            message: 'Invalid phone number. Must start with 265 (e.g. 265991234567 for Airtel, 265881234567 for TNM)',
        });
    }

    // Validate correspondent
    if (!Object.values(CORRESPONDENTS).includes(correspondent)) {
        return res.status(400).json({
            error: true,
            message: `Invalid correspondent. Use one of: ${Object.values(CORRESPONDENTS).join(', ')}`,
        });
    }

    try {
        const response = await pawapayClient.post('/v1/deposits', {
            depositId: randomUUID(),
            amount,
            currency: DEFAULT_CURRENCY,
            correspondent,
            payer: { type: 'MSISDN', address: { value: address } },
            customerTimestamp: customerTimestamp || new Date().toISOString(),
            statementDescription: statementDescription || 'Payment - Malawi',
        });

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Check deposit status
server.get('/deposits/:depositId', async (req, res) => {
    const { depositId } = req.params;

    try {
        const response = await pawapayClient.get(`/v1/deposits/${depositId}`);

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Resend deposit callback
server.post('/deposits/:depositId/resend-callback', async (req, res) => {
    const { depositId } = req.params;

    try {
        const response = await pawapayClient.post(`/v1/deposits/${depositId}/resend-callback`);

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// ==========================================
// PAYOUTS
// ==========================================

// Initiate a payout
server.post('/payouts/initiate', async (req, res) => {
    const {
        amount,
        address,
        correspondent,
        statementDescription
    } = req.body;

    if (!amount || !address || !correspondent) {
        return res.status(400).json({
            error: true,
            message: 'amount, address and correspondent are required. Use AIRTEL_OAPI_MWI or TNM_MPAMBA_MWI',
        });
    }

    // Validate Malawi phone number
    if (!address.startsWith('265')) {
        return res.status(400).json({
            error: true,
            message: 'Invalid phone number. Must start with 265 (e.g. 265991234567 for Airtel, 265881234567 for TNM)',
        });
    }

    // Validate correspondent
    if (!Object.values(CORRESPONDENTS).includes(correspondent)) {
        return res.status(400).json({
            error: true,
            message: `Invalid correspondent. Use one of: ${Object.values(CORRESPONDENTS).join(', ')}`,
        });
    }

    try {
        const response = await pawapayClient.post('/v1/payouts', {
            payoutId: randomUUID(),
            amount,
            currency: DEFAULT_CURRENCY,
            correspondent,
            recipient: { type: 'MSISDN', address: { value: address } },
            customerTimestamp: new Date().toISOString(),
            statementDescription: statementDescription || 'Payout - Malawi',
        });

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Check payout status
server.get('/payouts/:payoutId', async (req, res) => {
    const { payoutId } = req.params;

    try {
        const response = await pawapayClient.get(`/v1/payouts/${payoutId}`);

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Resend payout callback
server.post('/payouts/:payoutId/resend-callback', async (req, res) => {
    const { payoutId } = req.params;

    try {
        const response = await pawapayClient.post(`/v1/payouts/${payoutId}/resend-callback`);

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// ==========================================
// REFUNDS
// ==========================================

// Initiate a refund
server.post('/refunds/initiate', async (req, res) => {
    const { depositId, amount } = req.body;

    if (!depositId || !amount) {
        return res.status(400).json({
            error: true,
            message: 'depositId and amount are required',
        });
    }

    try {
        const response = await pawapayClient.post('/v1/refunds', {
            refundId: randomUUID(),
            depositId,
            amount,
            currency: DEFAULT_CURRENCY,
        });

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Check refund status
server.get('/refunds/:refundId', async (req, res) => {
    const { refundId } = req.params;

    try {
        const response = await pawapayClient.get(`/v1/refunds/${refundId}`);

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Resend refund callback
server.post('/refunds/:refundId/resend-callback', async (req, res) => {
    const { refundId } = req.params;

    try {
        const response = await pawapayClient.post(`/v1/refunds/${refundId}/resend-callback`);

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// ==========================================
// AVAILABILITY & CORRESPONDENTS
// ==========================================

// Get active Malawi correspondents
server.get('/correspondents', async (_req, res) => {
    try {
        const response = await pawapayClient.get('/v1/active-conf');

        return res.status(200).json({
            error: false,
            country: 'Malawi',
            availableCorrespondents: CORRESPONDENTS,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Get correspondent availability
server.get('/correspondents/availability', async (_req, res) => {
    try {
        const response = await pawapayClient.get('/v1/availability');

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Predict correspondent from Malawi phone number
server.get('/correspondents/predict/:msisdn', async (req, res) => {
    const { msisdn } = req.params;

    if (!msisdn.startsWith('265')) {
        return res.status(400).json({
            error: true,
            message: 'Invalid Malawi phone number. Must start with 265',
        });
    }

    try {
        const response = await pawapayClient.get(`/v1/predict-correspondent?msisdn=${msisdn}`);

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// ==========================================
// WALLET BALANCES
// ==========================================

// Get all wallet balances
server.get('/wallets/balances', async (_req, res) => {
    try {
        const response = await pawapayClient.get('/v1/wallets/balances');

        return res.status(200).json({
            error: false,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// Get Malawi wallet balance
server.get('/wallets/balances/malawi', async (_req, res) => {
    try {
        const response = await pawapayClient.get(`/v1/wallets/balances/${DEFAULT_COUNTRY}`);

        return res.status(200).json({
            error: false,
            country: 'Malawi',
            currency: DEFAULT_CURRENCY,
            data: response.data,
        });
    } catch (error: any) {
        return res.status(error.response?.status || 500).json({
            error: true,
            message: error.response?.data || error.message,
        });
    }
});

// ==========================================
// START SERVER
// ==========================================
server.listen(process.env.PORT || 9000, () => {
    console.log(`🇲🇼 Malawi Payment API running on port ${process.env.PORT || 9000}`);
    console.log(`Currency: ${DEFAULT_CURRENCY} | Country: ${DEFAULT_COUNTRY}`);
    console.log(`Correspondents: ${Object.values(CORRESPONDENTS).join(', ')}`);
});