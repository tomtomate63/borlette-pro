// URL de l'API
const API_BASE_URL = window.location.origin;

let currentUser = null;
let currentItems = [];
let currentTicketTab = 'all';
let agentStats = null;

// Afficher la date actuelle
function updateDate() {
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const now = new Date();
        dateElement.textContent = now.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success && !data.user.isAdmin) {
            currentUser = data.user;
            document.getElementById('agentInfo').innerHTML = `
                <div class="agent-name"><i class="fas fa-user-circle"></i> ${currentUser.agentName || currentUser.name}</div>
                <div class="agent-zone"><i class="fas fa-map-marker-alt"></i> ${currentUser.zone}</div>
                <div class="agent-type"><i class="fas fa-tag"></i> ${currentUser.type === 'supervisor' ? 'Superviseur' : 'Vendeur'}</div>
            `;
            
            if (currentUser.isBlocked) {
                document.getElementById('blockedAlert').style.display = 'block';
            }
            
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('appPage').style.display = 'block';
            
            updateDate();
            setInterval(updateDate, 60000);
            
            loadAgentStats();
            loadTickets();
            loadPaymentPoints();
            
            // Rafraîchir toutes les 30 secondes
            setInterval(() => {
                if (currentUser) {
                    loadAgentStats();
                    loadTickets();
                }
            }, 30000);
        } else {
            document.getElementById('errorMsg').textContent = data.message || 'Identifiants incorrects';
            document.getElementById('errorMsg').style.display = 'block';
        }
    } catch (error) {
        document.getElementById('errorMsg').textContent = 'Erreur de connexion au serveur';
        document.getElementById('errorMsg').style.display = 'block';
    }
}

async function loadPaymentPoints() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payment-points`);
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('depositPointId');
            if (select) {
                select.innerHTML = data.paymentPoints
                    .filter(p => p.isActive)
                    .map(p => `<option value="${p.id}">${p.nom} - ${p.adresse}</option>`)
                    .join('');
            }
        }
    } catch (error) {
        console.error('Erreur chargement points:', error);
    }
}

async function makeDeposit() {
    const paymentPointId = parseInt(document.getElementById('depositPointId').value);
    const amount = parseInt(document.getElementById('depositAmount').value);
    const notes = document.getElementById('depositNotes').value;
    
    if (!paymentPointId || !amount || amount <= 0) {
        alert('Veuillez remplir tous les champs correctement');
        return;
    }
    
    if (amount > (currentUser.balance || 0)) {
        alert(`Solde insuffisant. Votre solde actuel est de ${(currentUser.balance || 0).toLocaleString()} GDS`);
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentUser.id,
                amount: amount,
                paymentPointId: paymentPointId,
                notes: notes
            })
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('depositResult');
        if (data.success) {
            resultDiv.className = 'deposit-result success';
            resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ✅ Déchargement effectué ! Nouveau solde: ${data.newBalance.toLocaleString()} GDS`;
            document.getElementById('depositAmount').value = '';
            document.getElementById('depositNotes').value = '';
            loadAgentStats();
        } else {
            resultDiv.className = 'deposit-result error';
            resultDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ❌ ${data.message}`;
        }
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
            resultDiv.className = 'deposit-result';
        }, 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

function addNumber() {
    const number = document.getElementById('inputNumber').value.trim();
    const amount = parseInt(document.getElementById('inputAmount').value);
    const ticketType = document.getElementById('inputType').value;
    
    if (!number) {
        alert('Entrez un numéro');
        return;
    }
    
    // Vérifier la longueur selon le type
    if (ticketType === 'simple' && number.length !== 2) {
        alert('Pour 2 chiffres, entrez un numéro de 00 à 99');
        return;
    }
    if (ticketType === 'three' && number.length !== 3) {
        alert('Pour 3 chiffres, entrez un numéro de 000 à 999');
        return;
    }
    if (ticketType === 'five' && number.length !== 5) {
        alert('Pour 5 chiffres, entrez un numéro de 00000 à 99999');
        return;
    }
    
    if (isNaN(amount) || amount < 10) {
        alert('Montant minimum: 10 GDS');
        return;
    }
    
    currentItems.push({
        number: number,
        amount: amount,
        ticketType: ticketType
    });
    
    updateItemsDisplay();
    
    // Réinitialiser les champs
    document.getElementById('inputNumber').value = '';
    document.getElementById('inputAmount').value = '10';
    document.getElementById('inputNumber').focus();
}

function updateItemsDisplay() {
    const container = document.getElementById('itemsList');
    const total = currentItems.reduce((sum, item) => sum + item.amount, 0);
    
    if (currentItems.length === 0) {
        container.innerHTML = '<p class="empty-message"><i class="fas fa-inbox"></i> Aucun numéro sélectionné</p>';
    } else {
        container.innerHTML = currentItems.map((item, index) => {
            let typeText = item.ticketType === 'simple' ? '2 chiffres' : (item.ticketType === 'three' ? '3 chiffres' : '5 chiffres');
            let typeClass = item.ticketType === 'simple' ? 'type-simple' : (item.ticketType === 'three' ? 'type-three' : 'type-five');
            return `
                <div class="item-row ${typeClass}">
                    <span class="item-number"><strong>${item.number}</strong> <span class="item-type">${typeText}</span></span>
                    <span class="item-amount">${item.amount.toLocaleString()} GDS</span>
                    <button class="remove-item" onclick="removeItem(${index})"><i class="fas fa-times"></i></button>
                </div>
            `;
        }).join('');
    }
    
    document.getElementById('totalAmount').textContent = total.toLocaleString() + ' GDS';
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
    if (currentItems.length === 0) {
        alert('Ajoutez au moins un numéro');
        return;
    }
    
    if (currentUser.isBlocked) {
        alert('Votre POS est bloqué. Vous ne pouvez pas effectuer de ventes.');
        return;
    }
    
    const drawingName = document.getElementById('drawingName').value;
    const notes = document.getElementById('ticketNotes').value;
    const total = currentItems.reduce((sum, item) => sum + item.amount, 0);
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/sell-multi-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentUser.id,
                items: currentItems,
                drawingName: drawingName,
                notes: notes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const ticket = data.ticket;
            
            // Afficher le ticket pour impression
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Ticket Borlette - ${ticket.id}</title>
                    <style>
                        body { font-family: monospace; padding: 20px; text-align: center; }
                        .ticket { border: 2px dashed #333; padding: 20px; max-width: 300px; margin: 0 auto; }
                        h1 { color: #3B0458; font-size: 18px; margin: 0; }
                        .date { font-size: 12px; color: #666; margin: 5px 0; }
                        hr { border: 1px dashed #333; }
                        .items { text-align: left; margin: 15px 0; }
                        .item { display: flex; justify-content: space-between; margin: 5px 0; }
                        .total { font-weight: bold; font-size: 16px; margin-top: 10px; text-align: right; }
                        .footer { margin-top: 15px; font-size: 10px; color: #666; }
                        button { margin-top: 20px; padding: 10px 20px; cursor: pointer; }
                    </style>
                </head>
                <body>
                    <div class="ticket">
                        <h1>🎲 BORLETTE EXPRESS 🎲</h1>
                        <div class="date">${new Date(ticket.date).toLocaleString()}</div>
                        <div><strong>Ticket N°: ${ticket.id}</strong></div>
                        <div>Agent: ${currentUser.agentName || currentUser.name}</div>
                        <div>Tirage: ${ticket.drawingName}</div>
                        <hr>
                        <div class="items">
                            ${ticket.items.map(item => `
                                <div class="item">
                                    <span>${item.number} (${item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch')})</span>
                                    <span>${item.amount} GDS</span>
                                </div>
                            `).join('')}
                        </div>
                        <hr>
                        <div class="total">TOTAL: ${total} GDS</div>
                        ${notes ? `<div class="footer">Notes: ${notes}</div>` : ''}
                        <div class="footer">MERCI POUR VOTRE CONFIANCE !</div>
                    </div>
                    <button onclick="window.print();setTimeout(()=>window.close(),500);">🖨️ Imprimer</button>
                </body>
                </html>
            `);
            printWindow.document.close();
            
            alert(`✅ Vente enregistrée ! Ticket N°: ${ticket.id}\nTotal: ${total} GDS`);
            
            // Réinitialiser
            currentItems = [];
            updateItemsDisplay();
            document.getElementById('ticketNotes').value = '';
            loadAgentStats();
            loadTickets();
        } else {
            alert('❌ ' + data.message);
        }
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function cancelTicket() {
    const ticketId = document.getElementById('cancelTicketId').value.trim();
    const reason = document.getElementById('cancelReason').value.trim() || 'Annulation client';
    
    if (!ticketId) {
        alert('Entrez le numéro du ticket à annuler');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/cancel-ticket`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticketId: ticketId,
                agentId: currentUser.id,
                reason: reason
            })
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('cancelResult');
        if (data.success) {
            resultDiv.className = 'cancel-result success';
            resultDiv.innerHTML = `<i class="fas fa-check-circle"></i> ✅ ${data.message}`;
            document.getElementById('cancelTicketId').value = '';
            document.getElementById('cancelReason').value = '';
            loadAgentStats();
            loadTickets();
        } else {
            resultDiv.className = 'cancel-result error';
            resultDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ❌ ${data.message}`;
        }
        
        setTimeout(() => {
            resultDiv.style.display = 'none';
            resultDiv.className = 'cancel-result';
        }, 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function loadAgentStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agent-stats?agentId=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            agentStats = data.stats;
            document.getElementById('statSales').textContent = agentStats.totalSales.toLocaleString() + ' GDS';
            document.getElementById('statWins').textContent = agentStats.totalWins.toLocaleString() + ' GDS';
            document.getElementById('statProfit').textContent = agentStats.netProfit.toLocaleString() + ' GDS';
            document.getElementById('statCommission').textContent = agentStats.commission.toLocaleString() + ' GDS';
            document.getElementById('statBalance').textContent = (agentStats.balance || 0).toLocaleString() + ' GDS';
            
            // Mettre à jour le solde local
            if (currentUser) currentUser.balance = agentStats.balance;
        }
    } catch (error) {
        console.error('Erreur stats:', error);
    }
}

async function loadTickets() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agent-tickets?agentId=${currentUser.id}`);
        const data = await response.json();
        
        if (data.success) {
            let tickets = data.tickets;
            
            if (currentTicketTab === 'winners') {
                tickets = tickets.filter(t => t.isWinner || t.is_winner);
            } else if (currentTicketTab === 'cancelled') {
                tickets = tickets.filter(t => t.isCancelled || t.is_cancelled);
            } else {
                tickets = tickets.filter(t => !(t.isCancelled || t.is_cancelled));
            }
            
            displayTickets(tickets);
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

function displayTickets(tickets) {
    const container = document.getElementById('ticketsList');
    
    if (tickets.length === 0) {
        container.innerHTML = '<p class="empty-message"><i class="fas fa-inbox"></i> Aucun ticket</p>';
        return;
    }
    
    container.innerHTML = tickets.map(t => {
        let statusClass = '';
        let statusBadge = '';
        
        const isCancelled = t.isCancelled || t.is_cancelled;
        const isWinner = t.isWinner || t.is_winner;
        const winAmount = t.winAmount || t.win_amount || 0;
        
        if (isCancelled) {
            statusClass = 'cancelled';
            statusBadge = '<span class="cancelled-badge"><i class="fas fa-ban"></i> ANNULÉ</span>';
        } else if (isWinner) {
            statusClass = 'winner';
            statusBadge = `<span class="winner-badge"><i class="fas fa-trophy"></i> GAGNANT ! ${winAmount.toLocaleString()} GDS</span>`;
        } else {
            statusBadge = '<span class="pending-badge"><i class="fas fa-clock"></i> En attente</span>';
        }
        
        const itemsList = t.items ? t.items.map(item => {
            let typeText = item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch');
            let typeClass = item.ticketType === 'simple' ? 'type-simple' : (item.ticketType === 'three' ? 'type-three' : 'type-five');
            return `<div class="ticket-item-detail ${typeClass}"><span class="item-number-ticket">${item.number}</span> <span class="item-type-ticket">(${typeText})</span> : ${item.amount.toLocaleString()} GDS</div>`;
        }).join('') : `<div>Numéro: ${t.number} : ${t.amount} GDS</div>`;
        
        const totalAmount = t.totalAmount || t.total_amount || t.amount;
        const drawingName = t.drawingName || t.drawing_name;
        const ticketDate = t.date;
        const notes = t.notes;
        const cancelReason = t.cancelReason || t.cancel_reason;
        const cancelledAt = t.cancelledAt || t.cancelled_at;
        
        return `
            <div class="ticket-item ${statusClass}">
                <div class="ticket-header">
                    <strong><i class="fas fa-ticket-alt"></i> ${t.id}</strong>
                    ${statusBadge}
                </div>
                <div class="ticket-items">
                    ${itemsList}
                </div>
                <div class="ticket-footer">
                    <div><strong>Total: ${totalAmount.toLocaleString()} GDS</strong></div>
                    <div><i class="fas fa-calendar-alt"></i> Tirage: ${drawingName}</div>
                    <div><i class="fas fa-clock"></i> Date: ${new Date(ticketDate).toLocaleString()}</div>
                    ${notes ? `<div><i class="fas fa-sticky-note"></i> Notes: ${notes}</div>` : ''}
                    ${isCancelled ? `<div class="cancel-info"><i class="fas fa-info-circle"></i> Annulé le: ${new Date(cancelledAt).toLocaleString()}<br>Motif: ${cancelReason}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function showTicketTab(tab) {
    currentTicketTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    loadTickets();
}

function logout() {
    currentUser = null;
    currentItems = [];
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// Support des touches Entrée
document.getElementById('inputNumber')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addNumber();
    }
});

document.getElementById('inputAmount')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addNumber();
    }
});

// ========== CONNEXION AVEC TOUCHE ENTREE ==========
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
});

// Enregistrement du Service Worker pour PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => {
            console.log('Service Worker enregistré avec succès');
        })
        .catch(error => {
            console.log('Erreur Service Worker:', error);
        });
}