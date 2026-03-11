window.BUSINESS_CONFIG = {
    // Default costs (HT)
    costs: {
        cell_unit_buy_ht: 2.50,
        shipping_fixed_ht: 80,
        install_unit_ht: 5.00,
        travel_fixed_ht: 120,
        collect_frequency_per_year: 4,
        waste_fixed_cost_ht: 100,
        waste_unit_cost_ht: 3.5,
        tva_pct: 20,

        // Initial setup defaults (Buy/Sell)
        setup: {
            expert: { buy: 200, sell: 600 },
            install: { buy: 200, sell: 600 },
            training: { buy: 0, sell: 500 }
        }
    },

    // Subscription Tiers
    subscriptions: [
        {
            id: 'basic',
            name: 'Livraison Seule',
            price_per_cell_per_month: 12,
            description: 'Livraison des cellules filtrantes à votre port. Installation, remplacement et gestion des déchets à votre charge.',
            features: [
                { text: 'Fourniture de nouvelles cellules', included: true },
                { text: 'Frais de livraison inclus', included: true },
                { text: "Aucune pose / main d'œuvre", included: false },
                { text: 'Vous gérez le traitement des déchets', included: false }
            ]
        },
        {
            id: 'comfort',
            name: 'Pose & Remplacement',
            price_per_cell_per_month: 17,
            description: 'Livraison, installation initiale et remplacement périodique. Traitement et gestion des déchets hydrocarbures à votre charge.',
            features: [
                { text: 'Fourniture de nouvelles cellules', included: true },
                { text: 'Frais de livraison inclus', included: true },
                { text: 'Déplacement et pose des cellules', included: true },
                { text: 'Traitement des déchets à votre charge', included: false }
            ]
        },
        {
            id: 'premium',
            name: 'Clé en main (Tout inclus)',
            price_per_cell_per_month: 20,
            description: 'Service complet client déchargé : livraison, pose, remplacement régulier et gestion/traitement écologique des déchets hydrocarbures.',
            highlight: true,
            ribbon: 'Recommandé',
            features: [
                { text: 'Fourniture des cellules avec livraison', included: true },
                { text: 'Remplacement périodique complet', included: true },
                { text: 'Collecte sur site', included: true },
                { text: 'Recyclage / traitement des hydrocarbures', included: true }
            ]
        }
    ],

    // Estimation Parameters
    estimation: {
        default_moorings: 100,
        default_active_rate: 30, // %
        default_loss_per_boat: 0.5, // L/an
        default_cell_capacity: 10,  // L
        default_max_spacing: 10     // meters
    }
};
