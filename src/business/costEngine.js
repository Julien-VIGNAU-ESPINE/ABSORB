import { BUSINESS_CONFIG } from '../../config/business.js';

/**
 * Calculates all financial metrics for a project
 * @param {Object} params - Input parameters from the UI or state
 * @returns {Object} Calculated financial data
 */
export function calculateProjectMetrics(params) {
    const {
        n,              // Number of cells
        planId,         // Selected subscription plan ID
        buyPrices,      // Internal buy prices (expert, setup, training)
        sellPrices,     // Client sell prices (expert, setup, training)
        customCosts     // Custom overrides (unitBuy, shipping, travel, etc.)
    } = params;

    const plan = BUSINESS_CONFIG.subscriptions.find(p => p.id === planId) || BUSINESS_CONFIG.subscriptions[0];
    const isPremium = plan.id === 'premium';
    const isComfort = plan.id === 'comfort';

    // Config defaults
    const cfg = BUSINESS_CONFIG.costs;
    const unitBuy = customCosts.unitBuy ?? cfg.cell_unit_buy_ht;
    const shipping = customCosts.shipping ?? cfg.shipping_fixed_ht;
    const installU = customCosts.installUnit ?? cfg.install_unit_ht;
    const travel = customCosts.travel ?? cfg.travel_fixed_ht;
    const collectFreq = customCosts.collectFreq ?? cfg.collect_frequency_per_year;
    const wasteFixed = customCosts.wasteFixed ?? cfg.waste_fixed_cost_ht;
    const wasteUnit = customCosts.wasteUnit ?? cfg.waste_unit_cost_ht;
    const tva = (customCosts.tvaPct ?? cfg.tva_pct) / 100;

    // ── Setup Costs Logic (Internal vs Client) ──────────────────────
    const expertBuy = buyPrices.expert;
    const expertSell = sellPrices.expert;
    const setupBuy = buyPrices.setup;
    const setupSell = sellPrices.setup;

    // Training is conditional: only if NOT 20 euro plan (premium) or if specifically needed?
    // Actually the user said: "si le forfait a 20euro est choisi alors il n'y a pas besoin de former les employés."
    // 20€ plan is PREMIUM.
    const hasTraining = !isPremium;
    const trainingBuy = hasTraining ? buyPrices.training : 0;
    const trainingSell = hasTraining ? sellPrices.training : 0;

    const totalSetupInternal = expertBuy + setupBuy + trainingBuy;
    const totalSetupClient = expertSell + setupSell + trainingSell;

    // ── Subscription Math ───────────────────────────────────────────
    const monthlySubPrice = plan.price_per_cell_per_month;
    const sellMonthHT = n * monthlySubPrice;
    const sellYearHT = sellMonthHT * 12;

    // ── Internal Costs (Year 1) ─────────────────────────────────────
    // Year 1 shipments logic
    // Usually: initial delivery + replacements based on frequency
    const totalPassagesYear1 = 1 + collectFreq;
    const cellPurchasesYear1 = n * totalPassagesYear1 * unitBuy;
    const shippingYear1 = totalPassagesYear1 * shipping;

    let installYear1 = 0;
    let travelYear1 = 0;
    let wasteYear1 = 0;

    if (isComfort || isPremium) {
        installYear1 = n * totalPassagesYear1 * installU;
        travelYear1 = totalPassagesYear1 * travel;
    }

    if (isPremium) {
        const replacementPassages = Math.max(0, totalPassagesYear1 - 1);
        wasteYear1 = replacementPassages * (wasteFixed + (n * wasteUnit));
    }

    const cdrTotalYear1 = cellPurchasesYear1 + shippingYear1 + installYear1 + travelYear1 + wasteYear1 + totalSetupInternal;

    // ── Totals & Margins ────────────────────────────────────────────
    const totalClientHT = sellYearHT + totalSetupClient;
    const totalClientTTC = totalClientHT * (1 + tva);
    const marginYear1 = totalClientHT - cdrTotalYear1;
    const marginPctYear1 = totalClientHT > 0 ? (marginYear1 / totalClientHT * 100) : 0;

    // ── Recurring Years ─────────────────────────────────────────────
    // Future years = only replacements/collection
    const recurringPassages = collectFreq;
    const recurringRevHT = sellYearHT;
    const recurringCostInternal =
        (n * recurringPassages * unitBuy) +
        (recurringPassages * shipping) +
        ((isComfort || isPremium) ? (n * recurringPassages * installU + recurringPassages * travel) : 0) +
        (isPremium ? (recurringPassages * (wasteFixed + n * wasteUnit)) : 0);

    const recurringMargin = recurringRevHT - recurringCostInternal;

    return {
        n,
        plan,
        isPremium,
        hasTraining,
        tva,
        // Amounts
        totalSetupInternal,
        totalSetupClient,
        cellPurchasesYear1,
        shippingYear1,
        installYear1,
        travelYear1,
        wasteYear1,
        cdrTotalYear1,
        sellMonthHT,
        sellYearHT,
        totalClientHT,
        totalClientTTC,
        marginYear1,
        marginPctYear1,
        recurringRevHT,
        recurringCostInternal,
        recurringMargin,
        // Prices for display
        prices: {
            monthly: monthlySubPrice,
            expertSell,
            setupSell,
            trainingSell
        }
    };
}
