// caissier-app/script.js
const API_BASE_URL = window.location.origin;

let currentUser = null;
let currentItems = [];
let currentPointBalance = 0;

// ========== CONNEXION ==========
async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('Entrez vos identifiants');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success && data.user.type === 'caissier') {
            currentUser = data.user;
            document.getElementById('userInfo').innerHTML = `
                <div><i class="fas fa-user-circle"></i> ${currentUser.agentName || currentUser.name}</div>
                <div><i class="fas fa-map-marker-alt"></i> ${currentUser.zone}</div>
            `;
            
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('appPage').style.display = 'block';
            
            loadPointBalance();
            loadTransactions();
            loadPaymentPoints();
        } else {
            showError('Accès non autorisé - Compte caissier requis');
        }
    } catch (error) {
        showError('Erreur de connexion au serveur');
    }
}

function showError(message) {
    const errorDiv = document.getElementById('errorMsg');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

// ========== CHARGEMENT DU SOLDE DU POINT ==========
async function loadPointBalance() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payment-points`);
        const data = await response.json();
        
        if (data.success) {
            const point = data.paymentPoints.find(p => p.zone === currentUser.zone);
            if (point) {
                currentPointBalance = point.balance || 0;
                document.getElementById('pointBalance').innerHTML = currentPointBalance.toLocaleString() + ' GDS';
            }
        }
    } catch (error) {
        console.error('Erreur chargement solde:', error);
    }
}

// ========== CHARGEMENT DES POINTS DE PAIEMENT ==========
async function loadPaymentPoints() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payment-points`);
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('transferToPoint');
            if (select) {
                select.innerHTML = data.paymentPoints
                    .filter(p => p.zone !== currentUser.zone && p.isActive)
                    .map(p => `<option value="${p.id}">${p.nom} (${p.zone}) - Solde: ${(p.balance || 0).toLocaleString()} GDS</option>`)
                    .join('');
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ========== VENTE DE TICKETS ==========
function addNumber() {
    const number = document.getElementById('inputNumber').value.trim();
    const amount = parseInt(document.getElementById('inputAmount').value);
    const ticketType = document.getElementById('inputType').value;
    
    if (!number) {
        alert('Entrez un numéro');
        return;
    }
    
    if (ticketType === 'simple' && number.length !== 2) {
        alert('2 chiffres requis (00-99)');
        return;
    }
    if (ticketType === 'three' && number.length !== 3) {
        alert('3 chiffres requis (000-999)');
        return;
    }
    if (ticketType === 'five' && number.length !== 5) {
        alert('5 chiffres requis (00000-99999)');
        return;
    }
    
    if (isNaN(amount) || amount < 10) {
        alert('Montant minimum: 10 GDS');
        return;
    }
    
    currentItems.push({ number, amount, ticketType });
    updateItemsDisplay();
    
    document.getElementById('inputNumber').value = '';
    document.getElementById('inputAmount').value = '10';
    document.getElementById('inputNumber').focus();
}

function updateItemsDisplay() {
    const container = document.getElementById('itemsList');
    const total = currentItems.reduce((sum, item) => sum + item.amount, 0);
    
    if (currentItems.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucun numéro sélectionné</p>';
    } else {
        container.innerHTML = currentItems.map((item, index) => `
            <div class="item-row">
                <span><strong>${item.number}</strong> (${item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch')})</span>
                <span>${item.amount.toLocaleString()} GDS</span>
                <button class="remove-item" onclick="removeItem(${index})"><i class="fas fa-times"></i></button>
            </div>
        `).join('');
    }
    
    document.getElementById('totalAmount').textContent = total.toLocaleString();
}

function removeItem(index) {
    currentItems.splice(index, 1);
    updateItemsDisplay();
}

async function printTicket() {
    if (currentItems.length === 0) {
        alert('Ajoutez au moins un numéro');
        return;
    }
    
    const drawingName = document.getElementById('drawingName').value;
    const clientName = document.getElementById('clientName').value;
    const total = currentItems.reduce((sum, item) => sum + item.amount, 0);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/sell-multi-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentUser.id,
                items: currentItems,
                drawingName: drawingName,
                notes: clientName ? `Client: ${clientName}` : ''
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const ticket = data.ticket;
            
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Ticket Borlette - ${ticket.id}</title>
                    <style>
                        body { font-family: monospace; padding: 20px; text-align: center; }
                        .ticket { border: 2px dashed #333; padding: 20px; max-width: 300px; margin: 0 auto; }
                        h1 { color: #3B0458; }
                        .total { font-weight: bold; font-size: 16px; }
                        .footer { margin-top: 15px; font-size: 10px; }
                    </style>
                </head>
                <body>
                    <div class="ticket">
                        <h1>🎲 BORLETTE EXPRESS 🎲</h1>
                        <div>Ticket N°: ${ticket.id}</div>
                        <div>Caissier: ${currentUser.agentName || currentUser.name}</div>
                        <div>Tirage: ${ticket.drawingName}</div>
                        <hr>
                        ${ticket.items.map(item => `<div>${item.number} : ${item.amount} GDS</div>`).join('')}
                        <hr>
                        <div class="total">TOTAL: ${total} GDS</div>
                        ${clientName ? `<div>Client: ${clientName}</div>` : ''}
                        <div class="footer">MERCI !</div>
                    </div>
                    <button onclick="window.print();setTimeout(()=>window.close(),500);">🖨️ Imprimer</button>
                </body>
                </html>
            `);
            printWindow.document.close();
            
            alert(`✅ Vente enregistrée ! Ticket: ${ticket.id}`);
            
            currentItems = [];
            updateItemsDisplay();
            document.getElementById('clientName').value = '';
            loadPointBalance();
            loadTransactions();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        alert('Erreur de connexion');
    }
}

// ========== DÉCHARGEMENT ==========
async function makeDeposit() {
    const agentIdentifier = document.getElementById('depositAgentId').value.trim();
    const amount = parseInt(document.getElementById('depositAmount').value);
    const notes = document.getElementById('depositNotes').value;
    
    if (!agentIdentifier || !amount || amount <= 0) {
        alert('Remplissez tous les champs');
        return;
    }
    
    try {
        // Chercher l'agent par ID ou nom
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        
        const agent = agentsData.agents.find(a => a.id == agentIdentifier || a.username === agentIdentifier || a.agent_name === agentIdentifier);
        
        if (!agent) {
            alert('Agent non trouvé');
            return;
        }
        
        const response = await fetch(`${API_BASE_URL}/api/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: agent.id,
                amount: amount,
                paymentPointId: currentUser.id,
                notes: notes
            })
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('depositResult');
        if (data.success) {
            resultDiv.innerHTML = `<span style="color:green;">✅ ${amount.toLocaleString()} GDS déchargés pour ${agent.agent_name}</span>`;
            document.getElementById('depositAgentId').value = '';
            document.getElementById('depositAmount').value = '';
            document.getElementById('depositNotes').value = '';
            loadPointBalance();
            loadTransactions();
        } else {
            resultDiv.innerHTML = `<span style="color:red;">❌ ${data.message}</span>`;
        }
        
        setTimeout(() => resultDiv.innerHTML = '', 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

// ========== PAIEMENT TICKET GAGNANT ==========
async function payTicket() {
    const ticketId = document.getElementById('payTicketId').value.trim();
    
    if (!ticketId) {
        alert('Entrez le numéro du ticket');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/pay-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketId: ticketId,
                paymentPointId: currentUser.id
            })
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('payResult');
        if (data.success) {
            resultDiv.innerHTML = `<span style="color:green;">✅ ${data.message}</span>`;
            document.getElementById('payTicketId').value = '';
            loadPointBalance();
            loadTransactions();
        } else {
            resultDiv.innerHTML = `<span style="color:red;">❌ ${data.message}</span>`;
        }
        
        setTimeout(() => resultDiv.innerHTML = '', 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

// ========== TRANSFERT ENTRE POINTS ==========
async function makeTransfer() {
    const toPointId = parseInt(document.getElementById('transferToPoint').value);
    const amount = parseInt(document.getElementById('transferAmount').value);
    const notes = document.getElementById('transferNotes').value;
    
    if (!toPointId || !amount || amount <= 0) {
        alert('Remplissez tous les champs');
        return;
    }
    
    if (amount > currentPointBalance) {
        alert(`Solde insuffisant. Solde actuel: ${currentPointBalance.toLocaleString()} GDS`);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fromPointId: currentUser.id,
                toPointId: toPointId,
                amount: amount,
                notes: notes
            })
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('transferResult');
        if (data.success) {
            resultDiv.innerHTML = `<span style="color:green;">✅ ${amount.toLocaleString()} GDS transférés</span>`;
            document.getElementById('transferAmount').value = '';
            document.getElementById('transferNotes').value = '';
            loadPointBalance();
            loadTransactions();
        } else {
            resultDiv.innerHTML = `<span style="color:red;">❌ ${data.message}</span>`;
        }
        
        setTimeout(() => resultDiv.innerHTML = '', 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

// ========== HISTORIQUE DES TRANSACTIONS ==========
async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`);
        const data = await response.json();
        
        if (data.success && data.transactions) {
            const myTransactions = data.transactions
                .filter(t => t.payment_point_id === currentUser?.id)
                .slice(0, 20);
            
            const html = myTransactions.map(t => `
                <div class="transaction-item">
                    <div><strong>${t.type.toUpperCase()}</strong> - ${new Date(t.date).toLocaleString()}</div>
                    <div>${t.description || `${t.amount} GDS`}</div>
                    <div class="amount ${t.amount > 0 ? 'positive' : 'negative'}">${t.amount > 0 ? '+' : ''}${t.amount.toLocaleString()} GDS</div>
                </div>
            `).join('');
            
            document.getElementById('transactionsList').innerHTML = html || '<p>Aucune transaction</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ========== RAPPORT DU JOUR ==========
async function loadDailyReport() {
    if (!currentUser) return;
    
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // Récupérer les transactions du jour pour ce point
        const response = await fetch(`${API_BASE_URL}/api/transactions`);
        const data = await response.json();
        
        if (data.success && data.transactions) {
            const myTransactions = data.transactions.filter(t => 
                t.payment_point_id === currentUser.id && 
                new Date(t.date).toISOString().split('T')[0] === today
            );
            
            let sales = 0;
            let payouts = 0;
            let deposits = 0;
            let transfers = 0;
            
            myTransactions.forEach(t => {
                switch(t.type) {
                    case 'vente':
                        sales += t.amount;
                        break;
                    case 'paiement_gagnant':
                        payouts += Math.abs(t.amount);
                        break;
                    case 'dechargement':
                        deposits += t.amount;
                        break;
                    case 'transfert':
                        if (t.from_point_id === currentUser.id) transfers += t.amount;
                        break;
                }
            });
            
            document.getElementById('reportSales').innerHTML = sales.toLocaleString() + ' GDS';
            document.getElementById('reportPayouts').innerHTML = payouts.toLocaleString() + ' GDS';
            document.getElementById('reportDeposits').innerHTML = deposits.toLocaleString() + ' GDS';
            document.getElementById('reportTransfers').innerHTML = transfers.toLocaleString() + ' GDS';
            document.getElementById('reportBalance').innerHTML = currentPointBalance.toLocaleString() + ' GDS';
        }
    } catch (error) {
        console.error('Erreur chargement rapport:', error);
    }
}

function printReport() {
    const printContent = `
        <html>
        <head>
            <title>Rapport de caisse - ${currentUser.agentName || currentUser.name}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                h1 { color: #1e3c72; text-align: center; }
                .info { text-align: center; margin-bottom: 20px; color: #666; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                td { padding: 10px; border-bottom: 1px solid #ddd; }
                .label { font-weight: bold; }
                .total { font-weight: bold; font-size: 18px; color: #1e3c72; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
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
            <div class="footer">
                Document généré par Borlette Pro<br>
                Merci de votre confiance !
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.print();
}

function exportReportPDF() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('Génération PDF non disponible. Veuillez rafraîchir la page.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(30, 60, 114);
    doc.text('RAPPORT DE CAISSE', 14, 20);
    
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.text(`Caissier : ${currentUser.agentName || currentUser.name}`, 14, 35);
    doc.text(`Point : ${currentUser.zone}`, 14, 45);
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, 14, 55);
    doc.text(`Heure : ${new Date().toLocaleTimeString('fr-FR')}`, 14, 65);
    
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('💰 Ventes du jour :', 14, 85);
    doc.text(document.getElementById('reportSales').innerHTML, 120, 85);
    
    doc.text('🏆 Gains payés :', 14, 100);
    doc.text(document.getElementById('reportPayouts').innerHTML, 120, 100);
    
    doc.text('📥 Déchargements :', 14, 115);
    doc.text(document.getElementById('reportDeposits').innerHTML, 120, 115);
    
    doc.text('🔄 Transferts sortants :', 14, 130);
    doc.text(document.getElementById('reportTransfers').innerHTML, 120, 130);
    
    doc.setFontSize(14);
    doc.setTextColor(30, 60, 114);
    doc.text('💵 Solde actuel :', 14, 155);
    doc.text(document.getElementById('reportBalance').innerHTML, 120, 155);
    
    doc.save(`rapport_caisse_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ========== DÉCONNEXION ==========
function logout() {
    currentUser = null;
    currentItems = [];
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ========== TOUCHE ENTREE ==========
document.addEventListener('DOMContentLoaded', function() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    function handleEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            login();
        }
    }
    
    if (usernameInput) usernameInput.addEventListener('keypress', handleEnter);
    if (passwordInput) passwordInput.addEventListener('keypress', handleEnter);
    
    // Support Entrée pour ajout de numéro
    const inputNumber = document.getElementById('inputNumber');
    if (inputNumber) {
        inputNumber.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') addNumber();
        });
    }
});