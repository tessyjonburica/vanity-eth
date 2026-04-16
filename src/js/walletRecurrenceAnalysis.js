let nodeHttps = null;
try {
    // eslint-disable-next-line global-require
    nodeHttps = require('https');
} catch (err) {
    nodeHttps = null;
}

const ETH_DECIMALS = 18;
const DEFAULT_RECENT_LIMIT = 100;
const DEFAULT_REFERENCE_LIMIT = 100;
const DEFAULT_TOP_RESULTS = 10;

const DEFAULT_WEIGHTS = {
    recurrence: 0.35,
    recency: 0.2,
    value: 0.15,
    consistency: 0.12,
    directionality: 0.08,
    historicalPresence: 0.1,
};

const DEFAULT_LABELS = {
    exchanges: new Set(),
    spam: new Set(),
};

const getEnvApiKey = () => {
    if (typeof process !== 'undefined' && process && process.env && process.env.ETHERSCAN_API_KEY) {
        return process.env.ETHERSCAN_API_KEY;
    }
    return '';
};

const normalizeAddress = (address) => {
    if (!address || typeof address !== 'string') {
        return '';
    }
    return address.trim().toLowerCase();
};

const parseAmount = (rawValue, decimals) => {
    const raw = Number(rawValue || 0);
    const d = Number.isFinite(Number(decimals)) ? Number(decimals) : ETH_DECIMALS;
    if (!Number.isFinite(raw)) {
        return 0;
    }
    return raw / 10 ** d;
};

const toUnixTs = (tx) => Number(tx.timeStamp || tx.timestamp || 0);

const safeNumber = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return parsed;
};

const formatUsd = (value, options = {}) => {
    const num = safeNumber(value);
    const minimumFractionDigits = Number.isFinite(options.minimumFractionDigits) ? options.minimumFractionDigits : 2;
    const maximumFractionDigits = Number.isFinite(options.maximumFractionDigits) ? options.maximumFractionDigits : 8;

    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits,
            maximumFractionDigits,
        }).format(num);
    } catch (err) {
        const formatted = Math.abs(num).toLocaleString(undefined, { minimumFractionDigits, maximumFractionDigits });
        return `${num < 0 ? '-$' : '$'}${formatted}`;
    }
};

const requestJson = async (urlString) => {
    if (typeof fetch === 'function') {
        const response = await fetch(urlString);
        if (!response.ok) {
            throw new Error(`Request failed (${response.status}) for ${urlString}`);
        }
        return response.json();
    }

    if (!nodeHttps) {
        throw new Error('No HTTP client available in this environment.');
    }

    return new Promise((resolve, reject) => {
        const url = new URL(urlString);
        nodeHttps
            .get(
                {
                    protocol: url.protocol,
                    hostname: url.hostname,
                    path: `${url.pathname}${url.search}`,
                    port: url.port || undefined,
                },
                (res) => {
                    let body = '';
                    res.on('data', (chunk) => {
                        body += chunk;
                    });
                    res.on('end', () => {
                        try {
                            resolve(JSON.parse(body));
                        } catch (err) {
                            reject(new Error(`Invalid JSON response from ${urlString}: ${err.message}`));
                        }
                    });
                }
            )
            .on('error', (err) => reject(err));
    });
};

const buildEtherscanUrl = (baseUrl, params) => {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
    });
    return url.toString();
};

const fetchAction = async ({ baseUrl, apiKey, walletAddress, action, limit }) => {
    const url = buildEtherscanUrl(baseUrl, {
        chainid: '1',
        module: 'account',
        action,
        address: walletAddress,
        page: '1',
        offset: String(limit),
        sort: 'desc',
        apikey: apiKey || '',
    });
    const payload = await requestJson(url);
    const rows = Array.isArray(payload.result) ? payload.result : [];
    return rows;
};

const fetchAddressCode = async ({ baseUrl, apiKey, address }) => {
    const url = buildEtherscanUrl(baseUrl, {
        chainid: '1',
        module: 'proxy',
        action: 'eth_getCode',
        address,
        tag: 'latest',
        apikey: apiKey || '',
    });
    try {
        const payload = await requestJson(url);
        return payload.result || '0x';
    } catch (err) {
        return '0x';
    }
};

const mapNormalTransaction = (target, tx) => {
    const from = normalizeAddress(tx.from);
    const to = normalizeAddress(tx.to);
    const targetNorm = normalizeAddress(target);
    if (from !== targetNorm && to !== targetNorm) {
        return null;
    }

    const isOutgoing = from === targetNorm;
    const counterparty = isOutgoing ? to : from;
    if (!counterparty) {
        return null;
    }

    const isContractCall = Boolean(tx.input && tx.input !== '0x');
    return {
        hash: tx.hash || '',
        timestamp: toUnixTs(tx),
        from,
        to,
        sender: from,
        receiver: to,
        counterparty,
        direction: isOutgoing ? 'outbound' : 'inbound',
        valueNative: parseAmount(tx.value, ETH_DECIMALS),
        valueToken: 0,
        tokenSymbol: null,
        interactionType: isContractCall ? 'contract_interaction' : 'native_transfer',
        isZeroValue: Number(tx.value || 0) === 0,
    };
};

const mapTokenTransaction = (target, tx) => {
    const from = normalizeAddress(tx.from);
    const to = normalizeAddress(tx.to);
    const targetNorm = normalizeAddress(target);
    if (from !== targetNorm && to !== targetNorm) {
        return null;
    }

    const isOutgoing = from === targetNorm;
    const counterparty = isOutgoing ? to : from;
    if (!counterparty) {
        return null;
    }

    const tokenValue = parseAmount(tx.value, tx.tokenDecimal);
    return {
        hash: tx.hash || '',
        timestamp: toUnixTs(tx),
        from,
        to,
        sender: from,
        receiver: to,
        counterparty,
        direction: isOutgoing ? 'outbound' : 'inbound',
        valueNative: 0,
        valueToken: tokenValue,
        tokenSymbol: tx.tokenSymbol || null,
        interactionType: 'token_transfer',
        isZeroValue: Number(tx.value || 0) === 0,
    };
};

const mergeAndSliceWindows = (transactions, recentLimit, referenceLimit) => {
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);
    return {
        recent: sorted.slice(0, recentLimit),
        reference: sorted.slice(recentLimit, recentLimit + referenceLimit),
    };
};

const computeDirectionality = (senderCount, receiverCount) => {
    if (senderCount > 0 && receiverCount > 0) {
        return 'mixed';
    }
    return senderCount > receiverCount ? 'outbound' : 'inbound';
};

const computeConsistencyScore = (indexes, totalWindowSize) => {
    if (!indexes.length || !totalWindowSize) {
        return 0;
    }
    const bucketCount = 5;
    const bucketWidth = Math.max(1, Math.ceil(totalWindowSize / bucketCount));
    const bucketSet = new Set(indexes.map((idx) => Math.floor(idx / bucketWidth)));
    const coverage = bucketSet.size / bucketCount;
    return Number(coverage.toFixed(4));
};

const computeRecencyScore = (latestTimestamp, minTimestamp, maxTimestamp) => {
    if (!latestTimestamp || minTimestamp === maxTimestamp) {
        return 0;
    }
    const ratio = (latestTimestamp - minTimestamp) / (maxTimestamp - minTimestamp);
    return Number(Math.max(0, Math.min(1, ratio)).toFixed(4));
};

const computeValueScore = (total, maxTotalValue) => {
    if (!maxTotalValue) {
        return 0;
    }
    return Number(Math.max(0, Math.min(1, total / maxTotalValue)).toFixed(4));
};

const applyLabel = (address, labelConfig) => {
    if (labelConfig.exchanges.has(address)) {
        return 'exchange';
    }
    if (labelConfig.spam.has(address)) {
        return 'spam';
    }
    return 'unlabeled';
};

const detectAddressType = (code) => (code && code !== '0x' ? 'contract' : 'eoa');

const getDefaultNotes = (feature) => {
    const notes = [];
    if (feature.recurrenceCount >= 5) {
        notes.push('high recurrence in recent window');
    }
    if (feature.consistencyScore <= 0.2) {
        notes.push('interaction pattern is bursty');
    }
    if (feature.historicalPresence) {
        notes.push('seen in older reference window');
    }
    if (feature.label === 'spam') {
        notes.push('marked as spam source');
    }
    if (feature.addressType === 'contract') {
        notes.push('smart contract interaction may inflate recurrence');
    }
    return notes.join('; ') || 'no strong signals';
};

const detectAnomaly = (feature, maxRecurrence) => {
    const lowRecurrence = feature.recurrenceCount <= Math.max(1, Math.floor(maxRecurrence * 0.15));
    const burstyPattern = feature.consistencyScore <= 0.2;
    const zeroValueOnly = feature.totalValueExchanged <= 0 && feature.zeroValueInteractions > 0;
    const isLabeledSpam = feature.label === 'spam';
    return isLabeledSpam || (lowRecurrence && burstyPattern) || zeroValueOnly;
};

const calculateRawScore = (feature, weights) =>
    feature.recurrenceCountNorm * weights.recurrence +
    feature.recencyScore * weights.recency +
    feature.valueScore * weights.value +
    feature.consistencyScore * weights.consistency +
    feature.directionalityScore * weights.directionality +
    feature.historicalPresenceScore * weights.historicalPresence;

const applyDistortionPenalty = (score, feature) => {
    let penaltyMultiplier = 1;
    if (feature.label === 'spam') {
        penaltyMultiplier -= 0.4;
    }
    if (feature.label === 'exchange') {
        penaltyMultiplier -= 0.15;
    }
    if (feature.addressType === 'contract') {
        penaltyMultiplier -= 0.1;
    }
    return Math.max(0, Number((score * penaltyMultiplier).toFixed(6)));
};

const buildBaseFeatureMap = (transactions, targetAddress, historicalSet) => {
    const map = new Map();
    const target = normalizeAddress(targetAddress);

    transactions.forEach((tx, idx) => {
        if (!tx || !tx.counterparty || tx.counterparty === target) {
            return;
        }
        if (!map.has(tx.counterparty)) {
            map.set(tx.counterparty, {
                address: tx.counterparty,
                recurrenceCount: 0,
                senderCount: 0,
                receiverCount: 0,
                firstInteractionTimestamp: tx.timestamp,
                lastInteractionTimestamp: tx.timestamp,
                latestInteractionHash: tx.hash || '',
                totalNativeExchanged: 0,
                totalTokenExchanged: 0,
                totalValueExchanged: 0,
                totalOutgoingValue: 0,
                totalIncomingValue: 0,
                interactionIndexes: [],
                interactionTypes: new Set(),
                senderRepetitionFrequency: 0,
                historicalPresence: historicalSet.has(tx.counterparty),
                zeroValueInteractions: 0,
            });
        }

        const feature = map.get(tx.counterparty);
        const value = tx.valueNative + tx.valueToken;
        feature.recurrenceCount += 1;
        feature.interactionIndexes.push(idx);
        feature.firstInteractionTimestamp = Math.min(feature.firstInteractionTimestamp, tx.timestamp);
        if (tx.timestamp >= feature.lastInteractionTimestamp) {
            feature.lastInteractionTimestamp = tx.timestamp;
            feature.latestInteractionHash = tx.hash || feature.latestInteractionHash || '';
        }
        feature.totalNativeExchanged += tx.valueNative;
        feature.totalTokenExchanged += tx.valueToken;
        feature.totalValueExchanged += value;
        feature.interactionTypes.add(tx.interactionType);
        if (tx.direction === 'outbound') {
            feature.senderCount += 1;
            feature.totalOutgoingValue += value;
            feature.senderRepetitionFrequency += 1;
        } else {
            feature.receiverCount += 1;
            feature.totalIncomingValue += value;
        }
        if (tx.isZeroValue) {
            feature.zeroValueInteractions += 1;
        }
    });

    return map;
};

const computeFeatureScores = (featureMap, windowBounds, weights, labelsByAddress, codesByAddress) => {
    const features = Array.from(featureMap.values());
    const maxRecurrence = Math.max(...features.map((f) => f.recurrenceCount), 0);
    const maxValue = Math.max(...features.map((f) => f.totalValueExchanged), 0);

    return features.map((feature) => {
        const recurrenceCountNorm = maxRecurrence ? Number((feature.recurrenceCount / maxRecurrence).toFixed(4)) : 0;
        const recencyScore = computeRecencyScore(feature.lastInteractionTimestamp, windowBounds.min, windowBounds.max);
        const consistencyScore = computeConsistencyScore(feature.interactionIndexes, windowBounds.size);
        const valueScore = computeValueScore(feature.totalValueExchanged, maxValue);
        const directionality = computeDirectionality(feature.senderCount, feature.receiverCount);
        const directionalityScore = directionality === 'mixed' ? 1 : 0.6;
        const historicalPresenceScore = feature.historicalPresence ? 1 : 0;
        const label = labelsByAddress.get(feature.address) || 'unlabeled';
        const addressType = detectAddressType(codesByAddress.get(feature.address));

        const rawScore = calculateRawScore(
            {
                recurrenceCountNorm,
                recencyScore,
                valueScore,
                consistencyScore,
                directionalityScore,
                historicalPresenceScore,
            },
            weights
        );
        const finalScore = applyDistortionPenalty(rawScore, { label, addressType });

        const enriched = {
            address: feature.address,
            label,
            addressType,
            recurrenceCount: feature.recurrenceCount,
            senderCount: feature.senderCount,
            receiverCount: feature.receiverCount,
            senderRepetitionFrequency: feature.senderRepetitionFrequency,
            firstInteractionTimestamp: feature.firstInteractionTimestamp,
            lastInteractionTimestamp: feature.lastInteractionTimestamp,
            latestInteractionHash: feature.latestInteractionHash || '',
            totalValueExchanged: Number(feature.totalValueExchanged.toFixed(8)),
            totalNativeExchanged: Number(feature.totalNativeExchanged.toFixed(8)),
            totalTokenExchanged: Number(feature.totalTokenExchanged.toFixed(8)),
            totalOutgoingValue: Number(feature.totalOutgoingValue.toFixed(8)),
            totalIncomingValue: Number(feature.totalIncomingValue.toFixed(8)),
            dominantDirection: directionality,
            consistencyScore,
            historicalPresence: feature.historicalPresence,
            recurrenceCountNorm,
            recencyScore,
            valueScore,
            directionalityScore,
            historicalPresenceScore,
            finalRecurrenceScore: Number(finalScore.toFixed(6)),
            interactionTypes: Array.from(feature.interactionTypes),
            anomalyFlag: false,
            notes: '',
            zeroValueInteractions: feature.zeroValueInteractions,
        };
        return enriched;
    });
};

const getWindowBounds = (transactions) => {
    if (!transactions.length) {
        return { min: 0, max: 0, size: 0 };
    }
    const timestamps = transactions.map((tx) => tx.timestamp);
    return {
        min: Math.min(...timestamps),
        max: Math.max(...timestamps),
        size: transactions.length,
    };
};

const getLabelMap = (addresses, labelConfig) => {
    const labels = new Map();
    addresses.forEach((address) => {
        labels.set(address, applyLabel(address, labelConfig));
    });
    return labels;
};

const getCodeMap = async (addresses, options) => {
    const codeMap = new Map();
    await Promise.all(
        addresses.map(async (address) => {
            const code = await fetchAddressCode({
                baseUrl: options.etherscanBaseUrl,
                apiKey: options.apiKey,
                address,
            });
            codeMap.set(address, code);
        })
    );
    return codeMap;
};

const dedupeTransactions = (transactions) => {
    const seen = new Set();
    return transactions.filter((tx) => {
        const key = `${tx.hash}:${tx.counterparty}:${tx.interactionType}:${tx.timestamp}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
};

const isSuccessfulTransaction = (tx) => {
    if (!tx || typeof tx !== 'object') {
        return false;
    }
    if (tx.isError !== undefined) {
        return String(tx.isError) === '0';
    }
    if (tx.txreceipt_status !== undefined) {
        return String(tx.txreceipt_status) !== '0';
    }
    return true;
};

const shouldFilterSpamLikeTransaction = (tx, options = {}) => {
    const ignoreZeroValue = options.ignoreZeroValue !== false;
    if (!ignoreZeroValue) {
        return false;
    }
    return safeNumber(tx.valueNative) + safeNumber(tx.valueToken) <= 0;
};

const retrieveTransactions = async (walletAddress, options = {}) => {
    const config = {
        etherscanBaseUrl: options.etherscanBaseUrl || 'https://api.etherscan.io/v2/api',
        apiKey: options.apiKey || getEnvApiKey(),
        fetchLimit: options.fetchLimit || 200,
        recentLimit: options.recentLimit || DEFAULT_RECENT_LIMIT,
        referenceLimit: options.referenceLimit || DEFAULT_REFERENCE_LIMIT,
    };

    const [normalRows, tokenRows] = await Promise.all([
        fetchAction({
            baseUrl: config.etherscanBaseUrl,
            apiKey: config.apiKey,
            walletAddress,
            action: 'txlist',
            limit: config.fetchLimit,
        }),
        fetchAction({
            baseUrl: config.etherscanBaseUrl,
            apiKey: config.apiKey,
            walletAddress,
            action: 'tokentx',
            limit: config.fetchLimit,
        }),
    ]);

    const transactions = dedupeTransactions(
        [
            ...normalRows
                .filter(isSuccessfulTransaction)
                .map((tx) => mapNormalTransaction(walletAddress, tx))
                .filter(Boolean),
            ...tokenRows
                .filter(isSuccessfulTransaction)
                .map((tx) => mapTokenTransaction(walletAddress, tx))
                .filter(Boolean),
        ]
            .filter((tx) => !shouldFilterSpamLikeTransaction(tx, options))
            .sort((a, b) => b.timestamp - a.timestamp)
    );

    return mergeAndSliceWindows(transactions, config.recentLimit, config.referenceLimit);
};

const extractCounterpartyAddresses = (transactions, targetAddress) => {
    const target = normalizeAddress(targetAddress);
    return [...new Set(transactions.map((tx) => tx.counterparty).filter((addr) => addr && addr !== target))];
};

const calculateCounterpartyFeatures = async (
    targetAddress,
    recentTransactions,
    referenceTransactions,
    options = {}
) => {
    const wallet = normalizeAddress(targetAddress);
    const referenceSet = new Set(extractCounterpartyAddresses(referenceTransactions, wallet));
    const featureMap = buildBaseFeatureMap(recentTransactions, wallet, referenceSet);
    const windowBounds = getWindowBounds(recentTransactions);
    const addresses = Array.from(featureMap.keys());

    const labelConfig = {
        exchanges: options.exchangeAddresses || DEFAULT_LABELS.exchanges,
        spam: options.spamAddresses || DEFAULT_LABELS.spam,
    };

    const labelsByAddress = getLabelMap(addresses, labelConfig);
    const codesByAddress = await getCodeMap(addresses, options);
    const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };

    const features = computeFeatureScores(featureMap, windowBounds, weights, labelsByAddress, codesByAddress);
    const maxRecurrence = Math.max(...features.map((f) => f.recurrenceCount), 0);
    return features.map((feature) => {
        const anomalyFlag = detectAnomaly(feature, maxRecurrence);
        return {
            ...feature,
            anomalyFlag,
            notes: getDefaultNotes(feature),
        };
    });
};

const rankCounterparties = (features) =>
    [...features].sort((a, b) => {
        if (b.finalRecurrenceScore !== a.finalRecurrenceScore) {
            return b.finalRecurrenceScore - a.finalRecurrenceScore;
        }
        return b.recurrenceCount - a.recurrenceCount;
    });

const getNetFlowDirection = (totalSent, totalReceived) => {
    if (totalSent > totalReceived) {
        return 'mostly_sent';
    }
    if (totalReceived > totalSent) {
        return 'mostly_received';
    }
    return 'balanced';
};

const getSimpleInteractionLabel = (direction, recurrence) => {
    if (direction === 'mostly_sent') {
        return recurrence >= 3 ? 'frequent recipient' : 'recipient';
    }
    if (direction === 'mostly_received') {
        return recurrence >= 3 ? 'frequent sender' : 'sender';
    }
    return 'balanced counterparty';
};

const simplifyRankedCounterparties = (rankedCounterparties, options = {}) => {
    const topResults = Math.max(1, Number(options.topResults || DEFAULT_TOP_RESULTS));
    const simplified = rankedCounterparties.map((entry) => {
        const totalSent = safeNumber(entry.totalOutgoingValue);
        const totalReceived = safeNumber(entry.totalIncomingValue);
        const recurrence = Math.max(0, safeNumber(entry.recurrenceCount));
        const balance = Number((totalReceived - totalSent).toFixed(8));
        const direction = getNetFlowDirection(totalSent, totalReceived);
        return {
            address: normalizeAddress(entry.address),
            balance,
            recurrence,
            total_sent: Number(totalSent.toFixed(8)),
            total_received: Number(totalReceived.toFixed(8)),
            balance_display: formatUsd(balance),
            total_sent_display: formatUsd(totalSent),
            total_received_display: formatUsd(totalReceived),
            direction,
            label: getSimpleInteractionLabel(direction, recurrence),
            latest_tx_hash: entry.latestInteractionHash || '',
        };
    });

    return simplified
        .filter((entry) => entry.address)
        .sort((a, b) => {
            if (b.recurrence !== a.recurrence) {
                return b.recurrence - a.recurrence;
            }
            if (b.total_sent !== a.total_sent) {
                return b.total_sent - a.total_sent;
            }
            return a.address.localeCompare(b.address);
        })
        .slice(0, topResults);
};

const analyzeWalletRecurrence = async (walletAddress, options = {}) => {
    const normalizedWallet = normalizeAddress(walletAddress);
    if (!normalizedWallet || !normalizedWallet.startsWith('0x') || normalizedWallet.length !== 42) {
        throw new Error('Invalid Ethereum wallet address format.');
    }

    const { recent, reference } = await retrieveTransactions(normalizedWallet, options);
    const features = await calculateCounterpartyFeatures(normalizedWallet, recent, reference, {
        ...options,
        etherscanBaseUrl: options.etherscanBaseUrl || 'https://api.etherscan.io/v2/api',
        apiKey: options.apiKey || getEnvApiKey(),
    });
    const ranked = rankCounterparties(features);
    const simplified = simplifyRankedCounterparties(ranked, options);

    return {
        wallet: normalizedWallet,
        totalRecentTransactions: recent.length,
        totalReferenceTransactions: reference.length,
        counterparties: simplified,
    };
};

module.exports = {
    DEFAULT_WEIGHTS,
    analyzeWalletRecurrence,
    calculateCounterpartyFeatures,
    extractCounterpartyAddresses,
    normalizeAddress,
    rankCounterparties,
    retrieveTransactions,
    simplifyRankedCounterparties,
};
