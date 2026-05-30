// ========== VARIABLES GLOBALES ==========
var API_BASE_URL = window.location.origin;
var currentUser = null;
var currentItems = [];
var currentTicketTab = 'all';
var agentStats = null;

// ========== GESTION DE L'APPAREIL ==========
var deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
    deviceId = 'POS-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('deviceId', deviceId);
}

// ========== CONFIGURATION DES RÔLES ET PERMISSIONS ==========
var roleConfig = {
    admin: {
        name: 'Administrateur',
        sections: ['dashboard', 'sales', 'reports', 'deposit', 'payment', 'transfer', 'tickets']
    },
    caissier: {
        name: 'Caissier',
        sections: ['sales', 'reports', 'deposit', 'payment', 'transfer', 'tickets']
    },
    agent: {
        name: 'Agent',
        sections: ['sales', 'reports', 'tickets']
    }
};

// ========== FONCTIONS PRINCIPALES ==========
function login() {
    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('Entrez vos identifiants');
        return;
    }
    
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/login';
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    currentUser = data.user;
                    
                    // Déterminer le rôle
                    var role = 'agent';
                    if (currentUser.isAdmin || currentUser.type === 'admin') {
                        role = 'admin';
                    } else if (currentUser.type === 'caissier') {
                        role = 'caissier';
                    }
                    currentUser.role = role;
                    
                    // Afficher l'interface
                    document.getElementById('loginPage').style.display = 'none';
                    document.getElementById('appPage').style.display = 'flex';
                    document.getElementById('userRoleDisplay').innerHTML = roleConfig[role].name;
                    document.getElementById('userInfo').innerHTML = currentUser.agentName || currentUser.name;
                    
                    // Générer le menu selon le rôle
                    generateMenu(role);
                    
                    // Charger les données initiales
                    loadAgentStats();
                    loadTickets();
                    loadPaymentPoints();
                    
                    // Afficher la section par défaut
                    showSection('sales');
                } else {
                    showError(data.message || 'Identifiants incorrects');
                }
            } catch(e) {
                showError('Erreur de connexion');
            }
        } else {
            showError('Erreur de connexion au serveur');
        }
    };
    xhr.send(JSON.stringify({ username: username, password: password, deviceId: deviceId }));
}

function generateMenu(role) {
    var sections = roleConfig[role].sections;
    var menuHtml = '';
    
    var menuItems = {
        sales: { icon: 'fa-ticket-alt', name: 'Vente' },
        reports: { icon: 'fa-chart-bar', name: 'Rapports' },
        deposit: { icon: 'fa-hand-holding-usd', name: 'Déchargement' },
        payment: { icon: 'fa-money-bill-wave', name: 'Paiement gagnant' },
        transfer: { icon: 'fa-exchange-alt', name: 'Transfert' },
        tickets: { icon: 'fa-list', name: 'Mes tickets' }
    };
    
    for (var i = 0; i < sections.length; i++) {
        var sec = sections[i];
        if (menuItems[sec]) {
            menuHtml += '<button class="nav-btn" onclick="showSection(\'' + sec + '\')">';
            menuHtml += '<i class="fas ' + menuItems[sec].icon + '"></i> ' + menuItems[sec].name;
            menuHtml += '</button>';
        }
    }
    
    document.getElementById('navMenu').innerHTML = menuHtml;
}

function showSection(section) {
    // Cacher toutes les sections
    var sections = ['sales', 'reports', 'deposit', 'payment', 'transfer', 'tickets'];
    for (var i = 0; i < sections.length; i++) {
        var secEl = document.getElementById(sections[i] + 'Section');
        if (secEl) secEl.style.display = 'none';
    }
    
    // Afficher la section demandée
    var targetSection = document.getElementById(section + 'Section');
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Afficher/cacher la section ticket gratuit (seulement pour agent)
    var clientFreeSection = document.getElementById('clientFreeSection');
    if (clientFreeSection) {
        if (currentUser && currentUser.role === 'agent') {
            clientFreeSection.style.display = 'block';
        } else {
            clientFreeSection.style.display = 'none';
        }
    }
    
    // Mettre à jour le titre
    var titles = {
        sales: 'Vente de tickets',
        reports: 'Mes statistiques',
        deposit: 'Déchargement',
        payment: 'Paiement ticket gagnant',
        transfer: 'Transfert entre points',
        tickets: 'Mes tickets'
    };
    document.getElementById('sectionTitle').innerHTML = titles[section] || section;
    
    // Recharger les données si nécessaire
    if (section === 'reports') {
        updateReportStats();
    }
    if (section === 'tickets') {
        loadTickets();
    }
    if (section === 'deposit') {
        loadPaymentPoints();
    }
    if (section === 'transfer') {
        loadPaymentPointsForTransfer();
    }
}

// ========== STATISTIQUES ==========
function loadAgentStats() {
    if (!currentUser) return;
    
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/agent-stats?agentId=' + currentUser.id;
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    agentStats = data.stats;
                    updateReportStats();
                }
            } catch(e) {}
        }
    };
    xhr.send();
}

function updateReportStats() {
    if (!agentStats) return;
    
    document.getElementById('reportSales').innerHTML = (agentStats.totalSales || 0).toLocaleString() + ' GDS';
    document.getElementById('reportWins').innerHTML = (agentStats.totalWins || 0).toLocaleString() + ' GDS';
    document.getElementById('reportProfit').innerHTML = (agentStats.netProfit || 0).toLocaleString() + ' GDS';
    document.getElementById('reportCommission').innerHTML = (agentStats.commission || 0).toLocaleString() + ' GDS';
    document.getElementById('reportBalance').innerHTML = (agentStats.balance || 0).toLocaleString() + ' GDS';
}

function printRapport() {
    if (!agentStats) {
        alert('Chargement des statistiques...');
        loadAgentStats();
        setTimeout(function() { printRapport(); }, 1000);
        return;
    }
    
    var content = '';
    content += '================================\n';
    content += '      RAPPORT DE VENTES\n';
    content += '================================\n\n';
    content += 'Agent: ' + (currentUser.agentName || currentUser.name) + '\n';
    content += 'Zone: ' + currentUser.zone + '\n';
    content += 'Date: ' + new Date().toLocaleDateString('fr-FR') + '\n';
    content += 'Heure: ' + new Date().toLocaleTimeString('fr-FR') + '\n';
    content += '--------------------------------\n\n';
    content += '💰 Ventes totales: ' + (agentStats.totalSales || 0).toLocaleString() + ' GDS\n';
    content += '🏆 Gains: ' + (agentStats.totalWins || 0).toLocaleString() + ' GDS\n';
    content += '📈 Bénéfice net: ' + (agentStats.netProfit || 0).toLocaleString() + ' GDS\n';
    content += '💵 Commission: ' + (agentStats.commission || 0).toLocaleString() + ' GDS\n';
    content += '💰 Solde actuel: ' + (agentStats.balance || 0).toLocaleString() + ' GDS\n\n';
    content += '================================\n';
    content += 'Document généré par Borlette Pro\n';
    content += '================================\n';
    
    var printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Rapport Borlette</title>');
    printWindow.document.write('<style>body{font-family:monospace;padding:20px;}pre{font-size:14px;}</style>');
    printWindow.document.write('</head><body><pre>' + content + '</pre></body></html>');
    printWindow.document.close();
    printWindow.print();
    setTimeout(function() { printWindow.close(); }, 1000);
}

// ========== VENTE DE TICKETS ==========
function addNumber() {
    var number = document.getElementById('inputNumber').value.trim();
    var amount = parseInt(document.getElementById('inputAmount').value);
    var ticketType = document.getElementById('inputType').value;
    
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
    
    currentItems.push({ number: number, amount: amount, ticketType: ticketType });
    updateItemsDisplay();
    
    document.getElementById('inputNumber').value = '';
    document.getElementById('inputAmount').value = '10';
    document.getElementById('inputNumber').focus();
}

function updateItemsDisplay() {
    var container = document.getElementById('itemsList');
    var total = 0;
    for (var i = 0; i < currentItems.length; i++) {
        total += currentItems[i].amount;
    }
    
    if (currentItems.length === 0) {
        container.innerHTML = '<p class="empty-message">Aucun numéro sélectionné</p>';
    } else {
        var html = '';
        for (var i = 0; i < currentItems.length; i++) {
            var item = currentItems[i];
            var typeText = item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch');
            html += '<div class="item-row">' +
                '<span><strong>' + item.number + '</strong> (' + typeText + ')</span>' +
                '<span>' + item.amount.toLocaleString() + ' GDS</span>' +
                '<button class="remove-item" onclick="removeItem(' + i + ')"><i class="fas fa-times"></i></button>' +
            '</div>';
        }
        container.innerHTML = html;
    }
    document.getElementById('totalAmount').innerHTML = total.toLocaleString();
}

function removeItem(index) {
    currentItems.splice(index, 1);
    updateItemsDisplay();
}

function clearItems() {
    if (currentItems.length > 0 && confirm('Annuler cette vente ?')) {
        currentItems = [];
        updateItemsDisplay();
    }
}

function printTicket() {
    if (currentItems.length === 0) {
        alert('Ajoutez au moins un numéro');
        return;
    }
    
    var drawingName = document.getElementById('drawingName').value;
    var notes = document.getElementById('ticketNotes').value;
    var total = 0;
    for (var i = 0; i < currentItems.length; i++) {
        total += currentItems[i].amount;
    }
    
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/sell-multi-ticket';
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    var ticket = data.ticket;
                    alert('✅ Vente enregistrée ! Ticket: ' + ticket.id);
                    
                    // Impression du ticket
                    var ticketText = generateTicketText(ticket, total, notes);
                    printThermal(ticketText);
                    
                    currentItems = [];
                    updateItemsDisplay();
                    document.getElementById('ticketNotes').value = '';
                    loadAgentStats();
                    loadTickets();
                } else {
                    alert('❌ ' + data.message);
                }
            } catch(e) {
                alert('Erreur');
            }
        }
    };
    xhr.send(JSON.stringify({ agentId: currentUser.id, items: currentItems, drawingName: drawingName, notes: notes }));
}

function generateTicketText(ticket, total, notes) {
    var text = '';
    text += '================================\n';
    text += '      BORLETTE EXPRESS\n';
    text += '================================\n';
    text += 'Ticket: ' + ticket.id + '\n';
    text += 'Agent: ' + (currentUser.agentName || currentUser.name) + '\n';
    text += 'Date: ' + new Date().toLocaleString() + '\n';
    text += '--------------------------------\n';
    for (var i = 0; i < ticket.items.length; i++) {
        var item = ticket.items[i];
        var typeText = item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch');
        text += item.number + ' (' + typeText + ') : ' + item.amount + ' GDS\n';
    }
    text += '--------------------------------\n';
    text += 'TOTAL: ' + total + ' GDS\n';
    if (notes) text += 'Notes: ' + notes + '\n';
    text += '================================\n';
    text += 'MERCI POUR VOTRE CONFIANCE !\n';
    text += '================================\n\n\n';
    return text;
}

function printThermal(content) {
    var printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Impression</title>');
    printWindow.document.write('<style>body{font-family:monospace;padding:10px;margin:0;}pre{font-size:12px;margin:0;}</style>');
    printWindow.document.write('</head><body><pre>' + content + '</pre></body></html>');
    printWindow.document.close();
    printWindow.print();
    setTimeout(function() { printWindow.close(); }, 1000);
}

// ========== TICKETS GRATUITS ==========
function registerClientAndGetFreeTicket() {
    var prenom = document.getElementById('clientPrenom').value.trim();
    var nom = document.getElementById('clientNom').value.trim();
    var email = document.getElementById('clientEmail').value.trim();
    var nif = document.getElementById('clientNif').value.trim();
    
    if (!prenom || !nom) {
        alert('Entrez le prénom et le nom');
        return;
    }
    if (!email) {
        alert('Entrez l\'email');
        return;
    }
    
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/free-ticket';
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                var resultDiv = document.getElementById('freeTicketResult');
                if (data.success) {
                    resultDiv.innerHTML = '<span style="color:green;">✅ Ticket gratuit ! Numéro: ' + data.ticket.number + '</span>';
                    
                    var ticketText = '';
                    ticketText += '================================\n';
                    ticketText += '      TICKET GRATUIT\n';
                    ticketText += '================================\n';
                    ticketText += 'Ticket: ' + data.ticket.id + '\n';
                    ticketText += 'Client: ' + prenom + ' ' + nom + '\n';
                    ticketText += 'Email: ' + email + '\n';
                    ticketText += '--------------------------------\n';
                    ticketText += '🎲 NUMÉRO: ' + data.ticket.number + '\n';
                    ticketText += '(Lotto 5 chiffres)\n';
                    ticketText += '================================\n';
                    ticketText += 'BONNE CHANCE !\n';
                    ticketText += '================================\n';
                    
                    printThermal(ticketText);
                    
                    document.getElementById('clientPrenom').value = '';
                    document.getElementById('clientNom').value = '';
                    document.getElementById('clientEmail').value = '';
                    document.getElementById('clientNif').value = '';
                    loadAgentStats();
                    loadTickets();
                } else {
                    resultDiv.innerHTML = '<span style="color:red;">❌ ' + data.message + '</span>';
                }
                setTimeout(function() { resultDiv.innerHTML = ''; }, 3000);
            } catch(e) {}
        }
    };
    xhr.send(JSON.stringify({ agentId: currentUser.id, clientNom: nom, clientPrenom: prenom, clientEmail: email, clientNif: nif }));
}

// ========== TICKETS LISTE ==========
function loadTickets() {
    if (!currentUser) return;
    
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/agent-tickets?agentId=' + currentUser.id;
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                var tickets = data.tickets;
                
                if (currentTicketTab === 'winners') {
                    tickets = tickets.filter(function(t) { return t.isWinner || t.is_winner; });
                } else if (currentTicketTab === 'cancelled') {
                    tickets = tickets.filter(function(t) { return t.isCancelled || t.is_cancelled; });
                }
                
                displayTickets(tickets);
            } catch(e) {}
        }
    };
    xhr.send();
}

function displayTickets(tickets) {
    var container = document.getElementById('ticketsList');
    if (!container) return;
    
    if (tickets.length === 0) {
        container.innerHTML = '<p>Aucun ticket</p>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < tickets.length; i++) {
        var t = tickets[i];
        var isWinner = t.isWinner || t.is_winner;
        var isCancelled = t.isCancelled || t.is_cancelled;
        var winAmount = t.winAmount || t.win_amount || 0;
        
        var badge = '';
        if (isCancelled) badge = '<span class="cancelled-badge">ANNULÉ</span>';
        else if (isWinner) badge = '<span class="winner-badge">GAGNANT ' + winAmount + ' GDS</span>';
        else badge = '<span class="pending-badge">En attente</span>';
        
        html += '<div class="ticket-item">';
        html += '<div><strong>' + t.id + '</strong> ' + badge + '</div>';
        html += '<div>Total: ' + (t.totalAmount || t.total_amount || 0) + ' GDS</div>';
        html += '<div>Date: ' + new Date(t.date).toLocaleString() + '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function showTicketTab(tab) {
    currentTicketTab = tab;
    var btns = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    if (event && event.target) {
        event.target.classList.add('active');
    }
    loadTickets();
}

// ========== DÉCHARGEMENT ==========
function loadPaymentPoints() {
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/payment-points';
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                var select = document.getElementById('depositPointId');
                if (select && data.paymentPoints) {
                    var options = '';
                    for (var i = 0; i < data.paymentPoints.length; i++) {
                        var p = data.paymentPoints[i];
                        if (p.isActive) {
                            options += '<option value="' + p.id + '">' + p.nom + '</option>';
                        }
                    }
                    select.innerHTML = options;
                }
            } catch(e) {}
        }
    };
    xhr.send();
}

function makeDeposit() {
    var agentIdentifier = document.getElementById('depositAgentId').value.trim();
    var amount = parseInt(document.getElementById('depositAmount').value);
    var notes = document.getElementById('depositNotes').value;
    var paymentPointId = document.getElementById('depositPointId').value;
    
    if (!agentIdentifier || !amount || amount <= 0) {
        alert('Remplissez tous les champs');
        return;
    }
    
    // D'abord trouver l'agent
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/agents';
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                var agent = null;
                for (var i = 0; i < data.agents.length; i++) {
                    var a = data.agents[i];
                    if (a.id == agentIdentifier || a.username === agentIdentifier || a.agent_name === agentIdentifier) {
                        agent = a;
                        break;
                    }
                }
                if (!agent) {
                    alert('Agent non trouvé');
                    return;
                }
                
                var depositXhr = new XMLHttpRequest();
                depositXhr.open('POST', API_BASE_URL + '/api/deposit', true);
                depositXhr.setRequestHeader('Content-Type', 'application/json');
                depositXhr.onreadystatechange = function() {
                    if (depositXhr.readyState === 4) {
                        var resultDiv = document.getElementById('depositResult');
                        if (depositXhr.status === 200) {
                            try {
                                var result = JSON.parse(depositXhr.responseText);
                                if (result.success) {
                                    resultDiv.innerHTML = '<span style="color:green;">✅ ' + amount + ' GDS déchargés</span>';
                                    document.getElementById('depositAgentId').value = '';
                                    document.getElementById('depositAmount').value = '';
                                    document.getElementById('depositNotes').value = '';
                                    loadAgentStats();
                                } else {
                                    resultDiv.innerHTML = '<span style="color:red;">❌ ' + result.message + '</span>';
                                }
                            } catch(e) {}
                        } else {
                            resultDiv.innerHTML = '<span style="color:red;">❌ Erreur</span>';
                        }
                        setTimeout(function() { resultDiv.innerHTML = ''; }, 3000);
                    }
                };
                depositXhr.send(JSON.stringify({ agentId: agent.id, amount: amount, paymentPointId: parseInt(paymentPointId), notes: notes }));
            } catch(e) {}
        }
    };
    xhr.send();
}

// ========== TRANSFERT ==========
function loadPaymentPointsForTransfer() {
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/payment-points';
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                var selectFrom = document.getElementById('transferFrom');
                var selectTo = document.getElementById('transferTo');
                if (selectFrom && selectTo && data.paymentPoints) {
                    var options = '';
                    for (var i = 0; i < data.paymentPoints.length; i++) {
                        var p = data.paymentPoints[i];
                        if (p.isActive) {
                            options += '<option value="' + p.id + '">' + p.nom + '</option>';
                        }
                    }
                    selectFrom.innerHTML = options;
                    selectTo.innerHTML = options;
                }
            } catch(e) {}
        }
    };
    xhr.send();
}

function makeTransfer() {
    var fromPointId = parseInt(document.getElementById('transferFrom').value);
    var toPointId = parseInt(document.getElementById('transferTo').value);
    var amount = parseInt(document.getElementById('transferAmount').value);
    var notes = document.getElementById('transferNotes').value;
    
    if (!fromPointId || !toPointId || !amount || amount <= 0) {
        alert('Remplissez tous les champs');
        return;
    }
    if (fromPointId === toPointId) {
        alert('Impossible de transférer vers le même point');
        return;
    }
    
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/api/transfer', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            var resultDiv = document.getElementById('transferResult');
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        resultDiv.innerHTML = '<span style="color:green;">✅ ' + amount + ' GDS transférés</span>';
                        document.getElementById('transferAmount').value = '';
                        document.getElementById('transferNotes').value = '';
                    } else {
                        resultDiv.innerHTML = '<span style="color:red;">❌ ' + data.message + '</span>';
                    }
                } catch(e) {}
            } else {
                resultDiv.innerHTML = '<span style="color:red;">❌ Erreur</span>';
            }
            setTimeout(function() { resultDiv.innerHTML = ''; }, 3000);
        }
    };
    xhr.send(JSON.stringify({ fromPointId: fromPointId, toPointId: toPointId, amount: amount, notes: notes }));
}

// ========== PAIEMENT GAGNANT ==========
function payWinnerTicket() {
    var ticketId = document.getElementById('payTicketId').value.trim();
    if (!ticketId) {
        alert('Entrez le numéro du ticket');
        return;
    }
    
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/api/pay-ticket', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            var resultDiv = document.getElementById('payResult');
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.success) {
                        resultDiv.innerHTML = '<span style="color:green;">✅ ' + data.message + '</span>';
                        document.getElementById('payTicketId').value = '';
                        loadAgentStats();
                    } else {
                        resultDiv.innerHTML = '<span style="color:red;">❌ ' + data.message + '</span>';
                    }
                } catch(e) {}
            } else {
                resultDiv.innerHTML = '<span style="color:red;">❌ Erreur</span>';
            }
            setTimeout(function() { resultDiv.innerHTML = ''; }, 3000);
        }
    };
    xhr.send(JSON.stringify({ ticketId: ticketId, paymentPointId: currentUser.id }));
}

// ========== UTILITAIRES ==========
function showError(message) {
    var errorDiv = document.getElementById('errorMsg');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(function() {
        errorDiv.style.display = 'none';
    }, 3000);
}

function logout() {
    currentUser = null;
    currentItems = [];
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}