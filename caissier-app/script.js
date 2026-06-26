// ============================================================
// caissier-app/script.js — Version corrigée complète
// ============================================================
const API_BASE_URL = window.location.origin;

let currentUser         = null;
let currentItems        = [];
let currentPointBalance = 0;
let currentPointId      = null; // FIX: stocker l'ID réel du point de paiement

// ========== CONNEXION ==========
async function login() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showError('Veuillez entrer vos identifiants');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        // FIX: bloquer explicitement admin et agents — seul type 'caissier' autorisé
        const isAdmin = data.user && (
            data.user.isAdmin === true ||
            data.user.is_admin === true ||
            data.user.type === 'admin'
        );

        if (data.success && !isAdmin && data.user.type === 'caissier') {
            currentUser = data.user;

            document.getElementById('userInfo').innerHTML = `
                <div><i class="fas fa-user-circle"></i> ${currentUser.agentName || currentUser.name}</div>
                <div><i class="fas fa-map-marker-alt"></i> ${currentUser.zone}</div>
            `;

            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('appPage').style.display   = 'block';

            // Afficher la date
            updateDate();
            setInterval(updateDate, 60000);

            // Charger toutes les données
            await loadPointBalance();
            await loadDailyReport();
            await loadTransactions();
            await loadPaymentPoints();

            // Rafraîchissement automatique toutes les 60s
            setInterval(async () => {
                if (currentUser) {
                    await loadPointBalance();
                    await loadDailyReport();
                    await loadTransactions();
                }
            }, 60000);

        } else {
            const msg = isAdmin
                ? 'Accès réservé aux caissiers. Utilisez le panneau administrateur.'
                : (data.message || 'Accès non autorisé — compte caissier requis');
            showError(msg);
        }
    } catch (error) {
        console.error('Erreur connexion:', error);
        showError('Erreur de connexion au serveur');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMsg');
    if (!errorDiv) return;
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => { errorDiv.style.display = 'none'; }, 4000);
}

function updateDate() {
    const el = document.getElementById('currentDate');
    if (el) {
        el.textContent = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

// ========== DÉCONNEXION ==========
function logout() {
    currentUser         = null;
    currentItems        = [];
    currentPointBalance = 0;
    currentPointId      = null;
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display   = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ========== SOLDE DU POINT ==========
async function loadPointBalance() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payment-points`);
        const data = await response.json();

        if (data.success && data.paymentPoints) {
            // FIX: chercher par zone ET stocker l'ID réel du point
            // (currentUser.id est l'ID de l'utilisateur, pas forcément l'ID du point)
            const point = data.paymentPoints.find(p => p.zone === currentUser.zone && p.isActive);
            if (point) {
                currentPointBalance = point.balance || 0;
                currentPointId      = point.id;

                setHTML('pointBalance', currentPointBalance.toLocaleString() + ' GDS');

                // Alerte si point inactif
                const blocked = document.getElementById('blockedAlert');
                if (blocked) blocked.style.display = point.isActive ? 'none' : 'block';
            } else {
                setHTML('pointBalance', 'Point introuvable');
            }
        }
    } catch (error) {
        console.error('Erreur chargement solde:', error);
    }
}

// ========== POINTS DE PAIEMENT (select transfert) ==========
async function loadPaymentPoints() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payment-points`);
        const data = await response.json();

        if (data.success && data.paymentPoints) {
            const select = document.getElementById('transferToPoint');
            if (!select) return;

            const others = data.paymentPoints.filter(p => p.zone !== currentUser.zone && p.isActive);

            if (others.length > 0) {
                // FIX: garder l'option vide par défaut (ajoutée dans le HTML)
                select.innerHTML = '<option value="">— Sélectionner un point —</option>' +
                    others.map(p =>
                        `<option value="${p.id}">${p.nom} (${p.zone}) — Solde : ${(p.balance || 0).toLocaleString()} GDS</option>`
                    ).join('');
            } else {
                select.innerHTML = '<option value="">Aucun autre point actif disponible</option>';
            }
        }
    } catch (error) {
        console.error('Erreur chargement points:', error);
    }
}

// ========== VENTE DE TICKETS ==========
function addNumber() {
    const number     = document.getElementById('inputNumber').value.trim();
    const amount     = parseInt(document.getElementById('inputAmount').value);
    const ticketType = document.getElementById('inputType').value;

    if (!number) { alert('Entrez un numéro'); return; }

    // FIX: validation avec regex pour s'assurer que ce sont bien des chiffres
    if (ticketType === 'simple' && !/^\d{2}$/.test(number)) {
        alert('2 chiffres requis (00-99)'); return;
    }
    if (ticketType === 'three' && !/^\d{3}$/.test(number)) {
        alert('3 chiffres requis (000-999)'); return;
    }
    if (ticketType === 'five' && !/^\d{5}$/.test(number)) {
        alert('5 chiffres requis (00000-99999)'); return;
    }

    if (isNaN(amount) || amount < 10) { alert('Montant minimum : 10 GDS'); return; }

    currentItems.push({ number, amount, ticketType });
    updateItemsDisplay();

    document.getElementById('inputNumber').value = '';
    document.getElementById('inputAmount').value = '10';
    document.getElementById('inputNumber').focus();
}

function updateItemsDisplay() {
    const container = document.getElementById('itemsList');
    if (!container) return;
    const total = currentItems.reduce((sum, item) => sum + item.amount, 0);

    if (currentItems.length === 0) {
        container.innerHTML = '<p class="empty-message"><i class="fas fa-inbox"></i> Aucun numéro ajouté</p>';
    } else {
        container.innerHTML = currentItems.map((item, index) => {
            const typeLabel = item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch');
            const typeClass = item.ticketType === 'simple' ? 'type-simple' : (item.ticketType === 'three' ? 'type-three' : 'type-five');
            return `
                <div class="item-row ${typeClass}">
                    <span class="item-number"><strong>${item.number}</strong> <span class="item-type">${typeLabel}</span></span>
                    <span class="item-amount">${item.amount.toLocaleString()} GDS</span>
                    <button class="remove-item" onclick="removeItem(${index})"><i class="fas fa-times"></i></button>
                </div>`;
        }).join('');
    }

    // FIX: afficher "0 GDS" correctement (l'original affichait juste le nombre sans "GDS")
    const totalEl = document.getElementById('totalAmount');
    if (totalEl) totalEl.textContent = total.toLocaleString() + ' GDS';
}

function removeItem(index) {
    currentItems.splice(index, 1);
    updateItemsDisplay();
}

function clearItems() {
    if (currentItems.length > 0 && confirm('Voulez-vous vraiment annuler cette vente ?')) {
        currentItems = [];
        updateItemsDisplay();
    }
}

async function printTicket() {
    if (currentItems.length === 0) { alert('Ajoutez au moins un numéro'); return; }

    const drawingName  = document.getElementById('drawingName').value;
    const clientName   = document.getElementById('clientName').value.trim();
    const itemsToSend  = currentItems.slice(); // FIX: copier avant envoi
    const total        = itemsToSend.reduce((sum, item) => sum + item.amount, 0);

    try {
        const response = await fetch(`${API_BASE_URL}/api/sell-multi-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId:     currentUser.id,
                items:       itemsToSend,
                drawingName: drawingName,
                notes:       clientName ? `Client : ${clientName}` : ''
            })
        });

        const data = await response.json();

        if (data.success) {
            const ticket = data.ticket;

            // Réinitialiser APRÈS succès
            currentItems = [];
            updateItemsDisplay();
            document.getElementById('clientName').value = '';

            // Résultat visuel
            showResult('saleResult', `✅ Ticket ${ticket.id} enregistré — Total : ${total.toLocaleString()} GDS`, 'success');

            // FIX: vérifier que window.open n'est pas bloqué
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('✅ Vente enregistrée (ticket N° ' + ticket.id + ').\nAutorisez les pop-ups pour imprimer.');
            } else {
                const itemsHtml = ticket.items.map(item =>
                    `<div class="item"><span>${item.number} (${item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch')})</span><span>${item.amount.toLocaleString()} GDS</span></div>`
                ).join('');

                printWindow.document.write(`
                    <html><head>
                        <title>Ticket ${ticket.id}</title>
                        <style>
                            body{font-family:monospace;padding:20px;text-align:center;}
                            .ticket{border:2px dashed #333;padding:20px;max-width:300px;margin:0 auto;}
                            h1{color:#3B0458;font-size:18px;}
                            .item{display:flex;justify-content:space-between;margin:4px 0;text-align:left;}
                            .total{font-weight:bold;font-size:16px;text-align:right;margin-top:8px;}
                            .footer{margin-top:15px;font-size:10px;color:#666;}
                            button{margin-top:20px;padding:10px 20px;cursor:pointer;font-size:14px;}
                        </style>
                    </head><body>
                        <div class="ticket">
                            <h1>🎲 BORLETTE EXPRESS 🎲</h1>
                            <div>${new Date(ticket.date).toLocaleString()}</div>
                            <div><strong>Ticket N° : ${ticket.id}</strong></div>
                            <div>Caissier : ${currentUser.agentName || currentUser.name}</div>
                            <div>Tirage : ${ticket.drawingName}</div>
                            <hr>
                            <div>${itemsHtml}</div>
                            <hr>
                            <div class="total">TOTAL : ${total.toLocaleString()} GDS</div>
                            ${clientName ? `<div class="footer">Client : ${clientName}</div>` : ''}
                            <div class="footer">MERCI POUR VOTRE CONFIANCE !</div>
                        </div>
                        <button onclick="window.print();setTimeout(()=>window.close(),500);">🖨️ Imprimer</button>
                    </body></html>
                `);
                printWindow.document.close();
            }

            await loadPointBalance();
            await loadDailyReport();
            await loadTransactions();
        } else {
            showResult('saleResult', '❌ ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Erreur vente:', error);
        showResult('saleResult', '❌ Erreur de connexion au serveur', 'error');
    }
}

// ========== ANNULATION DE TICKET ==========
// FIX: fonction ajoutée — absente du script original, présente dans le HTML corrigé
async function cancelTicket() {
    const ticketId = document.getElementById('cancelTicketId')?.value.trim();
    const reason   = document.getElementById('cancelReason')?.value.trim() || 'Annulation caissier';

    if (!ticketId) { alert('Entrez le numéro du ticket à annuler'); return; }

    try {
        const response = await fetch(`${API_BASE_URL}/api/cancel-ticket`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketId: ticketId,
                agentId:  currentUser.id,
                reason:   reason
            })
        });

        const data = await response.json();

        if (data.success) {
            showResult('cancelResult', '✅ ' + data.message, 'success');
            document.getElementById('cancelTicketId').value = '';
            document.getElementById('cancelReason').value   = '';
            await loadPointBalance();
            await loadDailyReport();
            await loadTransactions();
        } else {
            showResult('cancelResult', '❌ ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Erreur annulation:', error);
        showResult('cancelResult', '❌ Erreur de connexion', 'error');
    }
}

// ========== DÉCHARGEMENT ==========
async function makeDeposit() {
    const agentIdentifier = document.getElementById('depositAgentId').value.trim();
    const amount          = parseInt(document.getElementById('depositAmount').value);
    const notes           = document.getElementById('depositNotes').value;

    if (!agentIdentifier || !amount || amount <= 0) {
        alert('Remplissez tous les champs correctement');
        return;
    }

    try {
        // Rechercher l'agent par ID ou nom d'utilisateur
        const agentsRes  = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();

        if (!agentsData.success || !agentsData.agents) {
            showResult('depositResult', '❌ Impossible de charger la liste des agents', 'error');
            return;
        }

        const agent = agentsData.agents.find(a =>
            String(a.id) === agentIdentifier ||
            a.username === agentIdentifier ||
            // FIX: compatibilité snake_case et camelCase
            (a.agentName || '').toLowerCase() === agentIdentifier.toLowerCase() ||
            (a.agent_name || '').toLowerCase() === agentIdentifier.toLowerCase()
        );

        if (!agent) {
            showResult('depositResult', '❌ Agent introuvable : ' + agentIdentifier, 'error');
            return;
        }

        // FIX: utiliser currentPointId (ID réel du point) au lieu de currentUser.id
        if (!currentPointId) {
            showResult('depositResult', '❌ Point de paiement non identifié. Rechargez la page.', 'error');
            return;
        }

        const response = await fetch(`${API_BASE_URL}/api/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId:        agent.id,
                amount:         amount,
                paymentPointId: currentPointId,
                notes:          notes
            })
        });

        const data = await response.json();

        if (data.success) {
            const agentDisplayName = agent.agentName || agent.agent_name || agent.username;
            showResult('depositResult', `✅ ${amount.toLocaleString()} GDS déchargés pour ${agentDisplayName}`, 'success');
            document.getElementById('depositAgentId').value = '';
            document.getElementById('depositAmount').value  = '';
            document.getElementById('depositNotes').value   = '';
            await loadPointBalance();
            await loadDailyReport();
            await loadTransactions();
        } else {
            showResult('depositResult', '❌ ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Erreur déchargement:', error);
        showResult('depositResult', '❌ Erreur de connexion', 'error');
    }
}

// ========== PAIEMENT TICKET GAGNANT ==========
async function payTicket() {
    const ticketId = document.getElementById('payTicketId').value.trim();

    if (!ticketId) { alert('Entrez le numéro du ticket'); return; }

    // FIX: utiliser currentPointId au lieu de currentUser.id
    if (!currentPointId) {
        showResult('payResult', '❌ Point de paiement non identifié. Rechargez la page.', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/pay-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketId:       ticketId,
                paymentPointId: currentPointId
            })
        });

        const data = await response.json();

        if (data.success) {
            showResult('payResult', '✅ ' + data.message, 'success');
            document.getElementById('payTicketId').value = '';
            await loadPointBalance();
            await loadDailyReport();
            await loadTransactions();
        } else {
            showResult('payResult', '❌ ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Erreur paiement:', error);
        showResult('payResult', '❌ Erreur de connexion', 'error');
    }
}

// ========== TRANSFERT ENTRE POINTS ==========
async function makeTransfer() {
    const toPointId = document.getElementById('transferToPoint').value;
    const amount    = parseInt(document.getElementById('transferAmount').value);
    const notes     = document.getElementById('transferNotes').value;

    // FIX: vérifier que toPointId n'est pas l'option vide ""
    if (!toPointId || !amount || amount <= 0) {
        alert('Sélectionnez un point de destination et entrez un montant valide');
        return;
    }

    if (!currentPointId) {
        showResult('transferResult', '❌ Point de paiement source non identifié. Rechargez la page.', 'error');
        return;
    }

    if (amount > currentPointBalance) {
        alert(`Solde insuffisant. Solde actuel : ${currentPointBalance.toLocaleString()} GDS`);
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromPointId: currentPointId, // FIX: ID réel du point
                toPointId:   parseInt(toPointId),
                amount:      amount,
                notes:       notes
            })
        });

        const data = await response.json();

        if (data.success) {
            showResult('transferResult', `✅ ${amount.toLocaleString()} GDS transférés avec succès`, 'success');
            document.getElementById('transferAmount').value = '';
            document.getElementById('transferNotes').value  = '';
            // Mise à jour locale immédiate + rechargement serveur
            currentPointBalance -= amount;
            setHTML('pointBalance', currentPointBalance.toLocaleString() + ' GDS');
            await loadPointBalance();
            await loadDailyReport();
            await loadTransactions();
            await loadPaymentPoints();
        } else {
            showResult('transferResult', '❌ ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Erreur transfert:', error);
        showResult('transferResult', '❌ Erreur de connexion', 'error');
    }
}

// ========== HISTORIQUE DES TRANSACTIONS ==========
async function loadTransactions() {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`);
        const data = await response.json();

        if (data.success && data.transactions) {
            let transactions = data.transactions;

            // FIX: appliquer les filtres de la barre de recherche (ajoutée dans le HTML)
            const search    = document.getElementById('filterTransaction')?.value.toLowerCase();
            const typeFilter = document.getElementById('filterTransactionType')?.value;

            if (search)     transactions = transactions.filter(t => (t.description || '').toLowerCase().includes(search));
            if (typeFilter) transactions = transactions.filter(t => t.type === typeFilter);

            // 30 dernières après filtrage
            const recent = transactions.slice(0, 30);

            if (recent.length === 0) {
                container.innerHTML = '<p class="empty-message">Aucune transaction trouvée</p>';
                return;
            }

            const typeIcons = {
                vente:            '💰',
                paiement_gagnant: '🏆',
                dechargement:     '📥',
                transfert:        '🔄',
                annulation:       '❌'
            };

            const typeLabels = {
                vente:            'VENTE',
                paiement_gagnant: 'PAIEMENT GAGNANT',
                dechargement:     'DÉCHARGEMENT',
                transfert:        'TRANSFERT',
                annulation:       'ANNULATION'
            };

            container.innerHTML = recent.map(t => {
                const icon        = typeIcons[t.type]  || '📋';
                const label       = typeLabels[t.type] || t.type.toUpperCase();
                const isNegative  = ['paiement_gagnant', 'transfert', 'annulation'].includes(t.type);
                const displayAmt  = Math.abs(t.amount || 0);
                const sign        = isNegative ? '−' : '+';
                const colorClass  = isNegative ? 'negative' : 'positive';

                return `
                    <div class="transaction-item ${t.type}">
                        <div class="transaction-header">
                            <strong>${icon} ${label}</strong>
                            <span class="transaction-date">${new Date(t.date).toLocaleString()}</span>
                        </div>
                        <div class="transaction-desc">${t.description || '—'}</div>
                        <div class="transaction-amount ${colorClass}">
                            ${sign}${displayAmt.toLocaleString()} GDS
                        </div>
                    </div>`;
            }).join('');
        } else {
            container.innerHTML = '<p class="empty-message">Aucune transaction</p>';
        }
    } catch (error) {
        console.error('Erreur transactions:', error);
        container.innerHTML = '<p class="error">Erreur de chargement des transactions</p>';
    }
}

// ========== RAPPORT DU JOUR ==========
async function loadDailyReport() {
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];

    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`);
        const data = await response.json();

        if (data.success && data.transactions) {
            let sales = 0, payouts = 0, deposits = 0, transfersOut = 0;

            data.transactions.forEach(t => {
                if (new Date(t.date).toISOString().split('T')[0] !== today) return;

                switch (t.type) {
                    case 'vente':            sales       += Math.abs(t.amount); break;
                    case 'paiement_gagnant': payouts     += Math.abs(t.amount); break;
                    case 'dechargement':     deposits    += Math.abs(t.amount); break;
                    case 'transfert':
                        // FIX: utiliser currentPointId pour identifier les transferts sortants
                        if (currentPointId && t.from_point_id === currentPointId) {
                            transfersOut += Math.abs(t.amount);
                        }
                        break;
                }
            });

            setHTML('reportSales',     sales.toLocaleString()        + ' GDS');
            setHTML('reportPayouts',   payouts.toLocaleString()      + ' GDS');
            setHTML('reportDeposits',  deposits.toLocaleString()     + ' GDS');
            setHTML('reportTransfers', transfersOut.toLocaleString() + ' GDS');
            setHTML('reportBalance',   currentPointBalance.toLocaleString() + ' GDS');

            // Stats du haut
            setHTML('todaySales',   sales.toLocaleString()   + ' GDS');
            setHTML('totalPayouts', payouts.toLocaleString() + ' GDS');
        }
    } catch (error) {
        console.error('Erreur rapport:', error);
    }
}

// ========== IMPRESSION DU RAPPORT ==========
function printReport() {
    // FIX: vérifier que window.open n'est pas bloqué
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('⚠️ Autorisez les pop-ups pour imprimer le rapport.');
        return;
    }

    printWindow.document.write(`
        <html><head>
            <title>Rapport de caisse — ${currentUser.agentName || currentUser.name}</title>
            <style>
                body{font-family:Arial,sans-serif;padding:20px;}
                h1{color:#1e3c72;text-align:center;}
                .info{text-align:center;margin-bottom:20px;color:#666;line-height:1.8;}
                table{width:100%;border-collapse:collapse;margin:20px 0;}
                td{padding:10px;border-bottom:1px solid #ddd;}
                .label{font-weight:bold;}
                .total td{font-weight:bold;font-size:18px;color:#1e3c72;border-top:2px solid #1e3c72;}
                .footer{text-align:center;margin-top:30px;font-size:12px;color:#666;}
                button{margin-top:20px;padding:10px 20px;cursor:pointer;font-size:14px;}
            </style>
        </head><body>
            <h1>🏦 RAPPORT DE CAISSE</h1>
            <div class="info">
                <strong>Caissier :</strong> ${currentUser.agentName || currentUser.name}<br>
                <strong>Point :</strong> ${currentUser.zone}<br>
                <strong>Date :</strong> ${new Date().toLocaleDateString('fr-FR')}<br>
                <strong>Heure :</strong> ${new Date().toLocaleTimeString('fr-FR')}
            </div>
            <table>
                <tr><td class="label">💰 Ventes du jour :</td><td>${document.getElementById('reportSales').innerHTML}</td></tr>
                <tr><td class="label">🏆 Gains payés :</td><td>${document.getElementById('reportPayouts').innerHTML}</td></tr>
                <tr><td class="label">📥 Déchargements :</td><td>${document.getElementById('reportDeposits').innerHTML}</td></tr>
                <tr><td class="label">🔄 Transferts sortants :</td><td>${document.getElementById('reportTransfers').innerHTML}</td></tr>
                <tr class="total"><td class="label">💵 Solde actuel :</td><td>${document.getElementById('reportBalance').innerHTML}</td></tr>
            </table>
            <div class="footer">Document généré par Borlette Pro</div>
        </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
    setTimeout(() => printWindow.close(), 1000);
}

// ========== EXPORT PDF ==========
function exportReportPDF() {
    const jsPDFLib = window.jspdf || (typeof jspdf !== 'undefined' ? jspdf : null);
    if (!jsPDFLib || !jsPDFLib.jsPDF) {
        alert('Bibliothèque PDF non disponible. Veuillez rafraîchir la page.');
        return;
    }

    const { jsPDF } = jsPDFLib;
    const doc = new jsPDF();
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const timeStr = new Date().toLocaleTimeString('fr-FR');

    doc.setFontSize(18);
    doc.setTextColor(30, 60, 114);
    doc.text('RAPPORT DE CAISSE', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Caissier : ${currentUser.agentName || currentUser.name}`, 14, 35);
    doc.text(`Point    : ${currentUser.zone}`,                           14, 43);
    doc.text(`Date     : ${dateStr}`,                                    14, 51);
    doc.text(`Heure    : ${timeStr}`,                                    14, 59);

    // FIX: utiliser autoTable si disponible, sinon fallback texte
    const rows = [
        ['💰 Ventes du jour',     document.getElementById('reportSales').textContent],
        ['🏆 Gains payés',        document.getElementById('reportPayouts').textContent],
        ['📥 Déchargements',      document.getElementById('reportDeposits').textContent],
        ['🔄 Transferts sortants',document.getElementById('reportTransfers').textContent],
        ['💵 Solde actuel',       document.getElementById('reportBalance').textContent],
    ];

    if (doc.autoTable) {
        doc.autoTable({
            head: [['Catégorie', 'Montant']],
            body: rows,
            startY: 70,
            theme: 'striped',
            headStyles: { fillColor: [30, 60, 114], textColor: 255 },
            styles: { fontSize: 11, cellPadding: 4 },
            margin: { left: 14, right: 14 }
        });
    } else {
        let y = 75;
        rows.forEach(row => {
            doc.setFontSize(11);
            doc.setTextColor(0);
            doc.text(row[0] + ' :', 14, y);
            doc.text(row[1], 120, y);
            y += 12;
        });
    }

    doc.save(`rapport_caisse_${dateStr.replace(/\//g, '-')}.pdf`);
}

// ========== MODE SOMBRE ==========
function initDarkMode() {
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        const btn = document.getElementById('darkModeToggle');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleDarkMode() {
    const btn = document.getElementById('darkModeToggle');
    if (document.body.classList.contains('dark-mode')) {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
        if (btn) btn.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

// ========== UTILITAIRES ==========
function showResult(id, message, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'result-msg ' + type;
    el.innerHTML = message;
    // FIX: reset après 4 secondes avec nettoyage complet
    setTimeout(() => {
        el.className  = 'result-msg';
        el.innerHTML  = '';
    }, 4000);
}

function setHTML(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', function() {
    initDarkMode();

    const toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleDarkMode);

    // Entrée pour connexion
    function handleEnter(e) { if (e.key === 'Enter') { e.preventDefault(); login(); } }
    const u = document.getElementById('username');
    const p = document.getElementById('password');
    if (u) u.addEventListener('keypress', handleEnter);
    if (p) p.addEventListener('keypress', handleEnter);

    // Entrée pour ajouter un numéro
    const inputNumber = document.getElementById('inputNumber');
    if (inputNumber) inputNumber.addEventListener('keypress', e => { if (e.key === 'Enter') addNumber(); });

    // Filtres de recherche transactions
    const filterTx   = document.getElementById('filterTransaction');
    const filterType = document.getElementById('filterTransactionType');
    if (filterTx)   filterTx.addEventListener('input',  loadTransactions);
    if (filterType) filterType.addEventListener('change', loadTransactions);
});