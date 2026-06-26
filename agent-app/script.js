// ============================================================
// agent-app/script.js — Version corrigée complète
// ============================================================
var API_BASE_URL = window.location.origin;

var currentUser    = null;
var currentItems   = [];
var currentTicketTab = 'all';
var agentStats     = null;

// ========== GESTION DU DEVICE ID ==========
var deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
    deviceId = 'POS-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('deviceId', deviceId);
}

// ========== VÉRIFICATION DU CODE PIN ==========
function verifyPOSPin(callback) {
    var storedPin = localStorage.getItem('posPin');

    if (!storedPin) {
        var enteredPin = prompt('🔒 ENTREZ LE CODE PIN DU POS :\n(Contactez l\'administrateur pour obtenir le code)');
        if (!enteredPin) {
            alert('Code PIN requis pour utiliser ce POS');
            if (callback) callback(false);
            return;
        }
        enteredPin = enteredPin.replace(/-/g, '').replace(/\s/g, '');
        localStorage.setItem('posPin', enteredPin);
        storedPin = enteredPin;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/api/verify-pos-pin', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    if (data.posName) localStorage.setItem('posName', data.posName);
                    if (callback) callback(true);
                } else {
                    localStorage.removeItem('posPin');
                    alert('❌ CODE PIN INVALIDE. Veuillez réessayer.');
                    if (callback) callback(false);
                }
            } catch(e) {
                alert('Erreur de traitement de la réponse PIN');
                if (callback) callback(false);
            }
        } else {
            alert('❌ Erreur de vérification du PIN. Vérifiez votre connexion.');
            if (callback) callback(false);
        }
    };
    xhr.send(JSON.stringify({
        pinCode: storedPin,
        deviceId: deviceId,
        posName: 'POS-' + deviceId.substring(0, 8)
    }));
}

// ========== VÉRIFICATION AUTORISATION APPAREIL ==========
function checkDeviceAuthorization(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/api/check-device', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        if (xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (callback) callback(data.authorized !== false);
            } catch(e) {
                if (callback) callback(true);
            }
        } else {
            if (callback) callback(true); // En cas d'erreur, on laisse passer
        }
    };
    xhr.send(JSON.stringify({ deviceId: deviceId }));
}

// ========== DATE ==========
function updateDate() {
    var el = document.getElementById('currentDate');
    if (el) {
        el.textContent = new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    }
}

// ========== CONNEXION ==========
function login() {
    var username = document.getElementById('username').value.trim();
    var password = document.getElementById('password').value;
    var errorDiv = document.getElementById('errorMsg');

    if (!username || !password) {
        errorDiv.textContent = 'Veuillez entrer vos identifiants';
        errorDiv.style.display = 'block';
        setTimeout(function() { errorDiv.style.display = 'none'; }, 4000);
        return;
    }

    verifyPOSPin(function(isPinValid) {
        if (!isPinValid) return;

        var xhr = new XMLHttpRequest();
        xhr.open('POST', API_BASE_URL + '/api/login', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState !== 4) return;
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);

                    // FIX: vérification explicite — bloquer les comptes admin
                    var isAdmin = data.user && (
                        data.user.isAdmin === true ||
                        data.user.is_admin === true ||
                        data.user.type === 'admin'
                    );

                    if (data.success && !isAdmin) {
                        currentUser = data.user;

                        // Afficher les infos agent
                        var agentInfoEl = document.getElementById('agentInfo');
                        if (agentInfoEl) {
                            agentInfoEl.innerHTML =
                                '<div class="agent-name"><i class="fas fa-user-circle"></i> ' + (currentUser.agentName || currentUser.name) + '</div>' +
                                '<div class="agent-zone"><i class="fas fa-map-marker-alt"></i> ' + currentUser.zone + '</div>' +
                                '<div class="agent-type"><i class="fas fa-tag"></i> ' + (currentUser.type === 'supervisor' ? 'Superviseur' : 'Vendeur') + '</div>';
                        }

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

                        // Rafraîchissement automatique toutes les 30s
                        setInterval(function() {
                            if (currentUser) {
                                loadAgentStats();
                                loadTickets();
                            }
                        }, 30000);

                    } else {
                        var msg = isAdmin
                            ? 'Accès réservé aux agents. Utilisez le panneau administrateur.'
                            : (data.message || 'Identifiants incorrects');
                        errorDiv.textContent = msg;
                        errorDiv.style.display = 'block';
                        setTimeout(function() { errorDiv.style.display = 'none'; }, 4000);
                    }
                } catch(e) {
                    errorDiv.textContent = 'Erreur de traitement de la réponse';
                    errorDiv.style.display = 'block';
                }
            } else {
                errorDiv.textContent = 'Erreur de connexion au serveur';
                errorDiv.style.display = 'block';
                setTimeout(function() { errorDiv.style.display = 'none'; }, 4000);
            }
        };
        xhr.send(JSON.stringify({ username: username, password: password, deviceId: deviceId }));
    });
}

// ========== DÉCONNEXION ==========
function logout() {
    currentUser   = null;
    currentItems  = [];
    agentStats    = null;
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display   = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ========== CHARGEMENT DES POINTS DE PAIEMENT ==========
// FIX: fonction manquante dans le script original
function loadPaymentPoints() {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE_URL + '/api/payment-points', true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.success && data.paymentPoints) {
                var select = document.getElementById('depositPointId');
                if (!select) return;
                var activePoints = data.paymentPoints.filter(function(p) { return p.isActive; });
                if (activePoints.length > 0) {
                    select.innerHTML = activePoints.map(function(p) {
                        return '<option value="' + p.id + '">' + p.nom + (p.adresse ? ' - ' + p.adresse : '') + '</option>';
                    }).join('');
                } else {
                    select.innerHTML = '<option value="">Aucun point de paiement actif</option>';
                }
            }
        } catch(e) { console.error('Erreur chargement points:', e); }
    };
    xhr.send();
}

// ========== DÉCHARGEMENT ==========
function makeDeposit() {
    var select = document.getElementById('depositPointId');
    var paymentPointId = select ? parseInt(select.value) : 0;
    var amount = parseInt(document.getElementById('depositAmount').value);
    var notes  = document.getElementById('depositNotes').value;
    var resultDiv = document.getElementById('depositResult');

    if (!paymentPointId || !amount || amount <= 0) {
        alert('Veuillez remplir tous les champs correctement');
        return;
    }

    if (amount > (currentUser.balance || 0)) {
        alert('Solde insuffisant. Votre solde actuel est de ' + (currentUser.balance || 0).toLocaleString() + ' GDS');
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/api/deposit', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.success) {
                resultDiv.className = 'deposit-result success';
                resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> ✅ Déchargement effectué ! Nouveau solde : ' + data.newBalance.toLocaleString() + ' GDS';
                document.getElementById('depositAmount').value = '';
                document.getElementById('depositNotes').value  = '';
                loadAgentStats();
            } else {
                resultDiv.className = 'deposit-result error';
                resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ ' + data.message;
            }
            // FIX: vider innerHTML aussi pour éviter le flash sur le prochain appel
            setTimeout(function() {
                resultDiv.style.display = 'none';
                resultDiv.className     = 'deposit-result';
                resultDiv.innerHTML     = '';
            }, 4000);
        } catch(e) { console.error('Erreur dépôt:', e); }
    };
    xhr.send(JSON.stringify({
        agentId: currentUser.id,
        amount: amount,
        paymentPointId: paymentPointId,
        notes: notes
    }));
}

// ========== SAISIE DES NUMÉROS ==========
function addNumber() {
    var number     = document.getElementById('inputNumber').value.trim();
    var amount     = parseInt(document.getElementById('inputAmount').value);
    var ticketType = document.getElementById('inputType').value;

    if (!number) { alert('Entrez un numéro'); return; }

    if (ticketType === 'simple' && (number.length !== 2 || !/^\d{2}$/.test(number))) {
        alert('Pour 2 chiffres, entrez un numéro de 00 à 99'); return;
    }
    if (ticketType === 'three' && (number.length !== 3 || !/^\d{3}$/.test(number))) {
        alert('Pour 3 chiffres, entrez un numéro de 000 à 999'); return;
    }
    if (ticketType === 'five' && (number.length !== 5 || !/^\d{5}$/.test(number))) {
        alert('Pour 5 chiffres, entrez un numéro de 00000 à 99999'); return;
    }

    if (isNaN(amount) || amount < 10) { alert('Montant minimum : 10 GDS'); return; }

    currentItems.push({ number: number, amount: amount, ticketType: ticketType });
    updateItemsDisplay();

    document.getElementById('inputNumber').value = '';
    document.getElementById('inputAmount').value = '10';
    document.getElementById('inputNumber').focus();
}

function updateItemsDisplay() {
    var container = document.getElementById('itemsList');
    var total = 0;
    for (var i = 0; i < currentItems.length; i++) { total += currentItems[i].amount; }

    if (currentItems.length === 0) {
        container.innerHTML = '<p class="empty-message"><i class="fas fa-inbox"></i> Aucun numéro sélectionné</p>';
    } else {
        var html = '';
        for (var i = 0; i < currentItems.length; i++) {
            var item = currentItems[i];
            var typeText  = item.ticketType === 'simple' ? '2 chiffres' : (item.ticketType === 'three' ? '3 chiffres' : '5 chiffres');
            var typeClass = item.ticketType === 'simple' ? 'type-simple' : (item.ticketType === 'three' ? 'type-three' : 'type-five');
            html += '<div class="item-row ' + typeClass + '">' +
                '<span class="item-number"><strong>' + item.number + '</strong> <span class="item-type">' + typeText + '</span></span>' +
                '<span class="item-amount">' + item.amount.toLocaleString() + ' GDS</span>' +
                '<button class="remove-item" onclick="removeItem(' + i + ')"><i class="fas fa-times"></i></button>' +
            '</div>';
        }
        container.innerHTML = html;
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

// ========== IMPRESSION DU TICKET ==========
function printTicket() {
    if (currentItems.length === 0) { alert('Ajoutez au moins un numéro'); return; }

    if (currentUser.isBlocked) {
        alert('Votre POS est bloqué. Vous ne pouvez pas effectuer de ventes.');
        return;
    }

    var drawingName   = document.getElementById('drawingName').value;
    var notes         = document.getElementById('ticketNotes').value;
    var itemsToSend   = currentItems.slice(); // copie avant envoi
    var total = 0;
    for (var i = 0; i < itemsToSend.length; i++) { total += itemsToSend[i].amount; }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/api/sell-multi-ticket', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.success) {
                var ticket = data.ticket;

                // FIX: vider les items APRÈS avoir récupéré la réponse
                currentItems = [];
                updateItemsDisplay();
                document.getElementById('ticketNotes').value = '';
                loadAgentStats();
                loadTickets();

                // FIX: vérifier que window.open n'est pas bloqué
                var printWindow = window.open('', '_blank');
                if (!printWindow) {
                    alert('✅ Ticket N° ' + ticket.id + ' enregistré (total : ' + total.toLocaleString() + ' GDS).\n\nAutorisez les pop-ups pour imprimer le ticket.');
                    return;
                }

                var itemsHtml = '';
                for (var i = 0; i < ticket.items.length; i++) {
                    var item = ticket.items[i];
                    var typeLabel = item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch');
                    itemsHtml += '<div class="item"><span>' + item.number + ' (' + typeLabel + ')</span><span>' + item.amount.toLocaleString() + ' GDS</span></div>';
                }

                printWindow.document.write(
                    '<html><head><title>Ticket ' + ticket.id + '</title>' +
                    '<style>' +
                    'body{font-family:monospace;padding:20px;text-align:center;margin:0;}' +
                    '.ticket{border:2px dashed #333;padding:20px;max-width:300px;margin:0 auto;}' +
                    'h1{color:#3B0458;font-size:18px;margin:0;}' +
                    '.date{font-size:12px;color:#666;margin:5px 0;}' +
                    'hr{border:1px dashed #333;}' +
                    '.items{text-align:left;margin:15px 0;}' +
                    '.item{display:flex;justify-content:space-between;margin:5px 0;}' +
                    '.total{font-weight:bold;font-size:16px;margin-top:10px;text-align:right;}' +
                    '.footer{margin-top:15px;font-size:10px;color:#666;}' +
                    'button{margin-top:20px;padding:10px 20px;cursor:pointer;font-size:14px;}' +
                    '</style></head><body>' +
                    '<div class="ticket">' +
                    '<h1>🎲 BORLETTE EXPRESS 🎲</h1>' +
                    '<div class="date">' + new Date(ticket.date).toLocaleString() + '</div>' +
                    '<div><strong>Ticket N° : ' + ticket.id + '</strong></div>' +
                    '<div>Agent : ' + (currentUser.agentName || currentUser.name) + '</div>' +
                    '<div>Tirage : ' + ticket.drawingName + '</div>' +
                    '<hr>' +
                    '<div class="items">' + itemsHtml + '</div>' +
                    '<hr>' +
                    '<div class="total">TOTAL : ' + total.toLocaleString() + ' GDS</div>' +
                    (notes ? '<div class="footer">Notes : ' + notes + '</div>' : '') +
                    '<div class="footer">MERCI POUR VOTRE CONFIANCE !</div>' +
                    '</div>' +
                    '<button onclick="window.print();setTimeout(function(){window.close();},500);">🖨️ Imprimer</button>' +
                    '</body></html>'
                );
                printWindow.document.close();

            } else {
                alert('❌ ' + data.message);
            }
        } catch(e) {
            alert('Erreur lors de l\'enregistrement du ticket');
            console.error(e);
        }
    };
    xhr.send(JSON.stringify({
        agentId: currentUser.id,
        items: itemsToSend,
        drawingName: drawingName,
        notes: notes
    }));
}

// ========== ANNULATION DE TICKET ==========
// FIX: une seule fonction unifiée avec vérification du délai de 10 minutes
function cancelTicket() {
    var ticketId = document.getElementById('cancelTicketId').value.trim();
    var reason   = document.getElementById('cancelReason').value.trim() || 'Annulation client';
    var resultDiv = document.getElementById('cancelResult');

    if (!ticketId) { alert('Entrez le numéro du ticket à annuler'); return; }

    // Vérifier d'abord le délai de 10 minutes via l'API agent-tickets
    var xhrCheck = new XMLHttpRequest();
    xhrCheck.open('GET', API_BASE_URL + '/api/agent-tickets?agentId=' + currentUser.id, true);
    xhrCheck.onreadystatechange = function() {
        if (xhrCheck.readyState !== 4) return;

        // Si on ne peut pas vérifier, on laisse le serveur décider
        var canProceed = true;
        if (xhrCheck.status === 200) {
            try {
                var data = JSON.parse(xhrCheck.responseText);
                var ticket = null;
                for (var i = 0; i < data.tickets.length; i++) {
                    if (data.tickets[i].id === ticketId) { ticket = data.tickets[i]; break; }
                }
                if (ticket) {
                    var diffMinutes = (new Date().getTime() - new Date(ticket.date).getTime()) / 60000;
                    if (diffMinutes > 10) {
                        alert('❌ Délai dépassé ! Ce ticket ne peut plus être annulé (délai de 10 minutes).');
                        canProceed = false;
                    }
                }
            } catch(e) { /* on laisse passer */ }
        }

        if (!canProceed) return;

        // Procéder à l'annulation
        var xhrCancel = new XMLHttpRequest();
        xhrCancel.open('PUT', API_BASE_URL + '/api/cancel-ticket', true);
        xhrCancel.setRequestHeader('Content-Type', 'application/json');
        xhrCancel.onreadystatechange = function() {
            if (xhrCancel.readyState !== 4) return;
            if (xhrCancel.status === 200) {
                try {
                    var cancelData = JSON.parse(xhrCancel.responseText);
                    if (cancelData.success) {
                        resultDiv.className = 'cancel-result success';
                        resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> ✅ ' + cancelData.message;
                        document.getElementById('cancelTicketId').value = '';
                        document.getElementById('cancelReason').value   = '';
                        loadAgentStats();
                        loadTickets();
                    } else {
                        resultDiv.className = 'cancel-result error';
                        resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ ' + cancelData.message;
                    }
                } catch(e) {
                    resultDiv.className = 'cancel-result error';
                    resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ Erreur lors de l\'annulation';
                }
            } else {
                resultDiv.className = 'cancel-result error';
                resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ Erreur de connexion';
            }
            // FIX: vider innerHTML aussi
            setTimeout(function() {
                resultDiv.style.display = 'none';
                resultDiv.className     = 'cancel-result';
                resultDiv.innerHTML     = '';
            }, 4000);
        };
        xhrCancel.send(JSON.stringify({ ticketId: ticketId, agentId: currentUser.id, reason: reason }));
    };
    xhrCheck.send();
}

// ========== STATISTIQUES AGENT ==========
function loadAgentStats() {
    if (!currentUser) return;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE_URL + '/api/agent-stats?agentId=' + currentUser.id, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.success) {
                agentStats = data.stats;
                // Mettre à jour les spans cachés (utilisés par le rapport)
                setTextContent('statSales',      (agentStats.totalSales  || 0).toLocaleString() + ' GDS');
                setTextContent('statWins',       (agentStats.totalWins   || 0).toLocaleString() + ' GDS');
                setTextContent('statProfit',     (agentStats.netProfit   || 0).toLocaleString() + ' GDS');
                setTextContent('statCommission', (agentStats.commission  || 0).toLocaleString() + ' GDS');
                setTextContent('statBalance',    (agentStats.balance     || 0).toLocaleString() + ' GDS');
                if (currentUser) currentUser.balance = agentStats.balance;
            }
        } catch(e) { console.error('Erreur stats:', e); }
    };
    xhr.send();
}

function setTextContent(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ========== CHARGEMENT DES TICKETS ==========
function loadTickets() {
    if (!currentUser) return;

    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE_URL + '/api/agent-tickets?agentId=' + currentUser.id, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.success) {
                var tickets = data.tickets;
                // FIX: onglet 'all' affiche TOUS les tickets sans filtrage
                if (currentTicketTab === 'winners') {
                    tickets = tickets.filter(function(t) { return t.isWinner || t.is_winner; });
                } else if (currentTicketTab === 'cancelled') {
                    tickets = tickets.filter(function(t) { return t.isCancelled || t.is_cancelled; });
                }
                // 'all' : pas de filtre
                displayTickets(tickets);
            }
        } catch(e) { console.error('Erreur tickets:', e); }
    };
    xhr.send();
}

function displayTickets(tickets) {
    var container = document.getElementById('ticketsList');
    if (!container) return;

    if (tickets.length === 0) {
        container.innerHTML = '<p class="empty-message"><i class="fas fa-inbox"></i> Aucun ticket</p>';
        return;
    }

    var html = '';
    for (var i = 0; i < tickets.length; i++) {
        var t = tickets[i];
        var isCancelled  = t.isCancelled  || t.is_cancelled;
        var isWinner     = t.isWinner     || t.is_winner;
        var isFreeTicket = t.is_free_ticket === true;
        var winAmount    = t.winAmount    || t.win_amount || 0;

        var statusClass = '';
        var statusBadge = '';
        if (isCancelled) {
            statusClass = 'cancelled';
            statusBadge = '<span class="cancelled-badge"><i class="fas fa-ban"></i> ANNULÉ</span>';
        } else if (isWinner) {
            statusClass = 'winner';
            statusBadge = '<span class="winner-badge"><i class="fas fa-trophy"></i> GAGNANT ! ' + winAmount.toLocaleString() + ' GDS</span>';
        } else if (isFreeTicket) {
            statusClass = 'free';
            statusBadge = '<span class="free-badge"><i class="fas fa-gift"></i> TICKET GRATUIT</span>';
        } else {
            statusBadge = '<span class="pending-badge"><i class="fas fa-clock"></i> En attente</span>';
        }

        var itemsList = '';
        if (isFreeTicket) {
            var freeNum = t.items && t.items[0] ? t.items[0].number : '???';
            itemsList = '<div class="ticket-item-detail free-number"><span class="item-number-ticket">' + freeNum + '</span> <span class="item-type-ticket">(Lotto 5 chiffres - OFFERT)</span></div>';
        } else if (t.items) {
            for (var j = 0; j < t.items.length; j++) {
                var item = t.items[j];
                var typeText  = item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch');
                var typeClass = item.ticketType === 'simple' ? 'type-simple' : (item.ticketType === 'three' ? 'type-three' : 'type-five');
                itemsList += '<div class="ticket-item-detail ' + typeClass + '"><span class="item-number-ticket">' + item.number + '</span> <span class="item-type-ticket">(' + typeText + ')</span> : ' + item.amount.toLocaleString() + ' GDS</div>';
            }
        } else {
            itemsList = '<div>' + t.number + ' : ' + (t.amount || 0).toLocaleString() + ' GDS</div>';
        }

        var totalAmount  = t.totalAmount || t.total_amount || t.amount || 0;
        var drawingName  = t.drawingName || t.drawing_name || '-';
        var cancelReason = t.cancelReason || t.cancel_reason || '';
        var cancelledAt  = t.cancelledAt  || t.cancelled_at;
        var clientInfo   = '';
        if (isFreeTicket && (t.client_nom || t.client_prenom)) {
            clientInfo = '<div><i class="fas fa-user"></i> Client : ' + (t.client_prenom || '') + ' ' + (t.client_nom || '') + '</div>';
        }

        html += '<div class="ticket-item ' + statusClass + '">' +
            '<div class="ticket-header"><strong><i class="fas fa-ticket-alt"></i> ' + t.id + '</strong>' + statusBadge + '</div>' +
            '<div class="ticket-items">' + itemsList + '</div>' +
            '<div class="ticket-footer">' +
                '<div><strong>Total : ' + totalAmount.toLocaleString() + ' GDS</strong></div>' +
                '<div><i class="fas fa-calendar-alt"></i> Tirage : ' + drawingName + '</div>' +
                '<div><i class="fas fa-clock"></i> Date : ' + new Date(t.date).toLocaleString() + '</div>' +
                clientInfo +
                (t.notes ? '<div><i class="fas fa-sticky-note"></i> Notes : ' + t.notes + '</div>' : '') +
                (isCancelled && cancelledAt ? '<div class="cancel-info"><i class="fas fa-info-circle"></i> Annulé le : ' + new Date(cancelledAt).toLocaleString() + '<br>Motif : ' + cancelReason + '</div>' : '') +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}

// ========== ONGLETS TICKETS ==========
// FIX: event passé explicitement depuis le HTML (onclick="showTicketTab('all', event)")
function showTicketTab(tab, event) {
    currentTicketTab = tab;
    var btns = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) { btns[i].classList.remove('active'); }
    if (event && event.target) {
        var btn = event.target.closest ? event.target.closest('.tab-btn') : event.target;
        if (btn) btn.classList.add('active');
    }
    loadTickets();
}

// ========== ENREGISTREMENT CLIENT + TICKET GRATUIT ==========
function registerClientAndGetFreeTicket() {
    var prenom = document.getElementById('clientPrenom').value.trim();
    var nom    = document.getElementById('clientNom').value.trim();
    var email  = document.getElementById('clientEmail').value.trim();
    var nif    = document.getElementById('clientNif').value.trim();
    var resultDiv = document.getElementById('freeTicketResult');

    if (!prenom || !nom) { alert('Veuillez entrer le prénom et le nom du client'); return; }
    if (!email)          { alert('Veuillez entrer l\'email du client'); return; }

    if (currentUser.isBlocked) {
        alert('Votre POS est bloqué. Vous ne pouvez pas effectuer cette action.');
        return;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('POST', API_BASE_URL + '/api/free-ticket', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.success) {
                resultDiv.className = 'free-ticket-result success';
                resultDiv.innerHTML =
                    '<i class="fas fa-gift"></i> <strong>Ticket gratuit offert !</strong><br>' +
                    'Numéro : <span style="font-size:20px;font-weight:bold;">' + data.ticket.number + '</span><br>' +
                    'ID Ticket : ' + data.ticket.id;

                // FIX: vérifier que la fenêtre d'impression s'ouvre
                var ticketText =
                    '================================\n' +
                    '      TICKET GRATUIT\n' +
                    '================================\n\n' +
                    'Ticket N° : ' + data.ticket.id + '\n' +
                    'Offert à : ' + prenom + ' ' + nom + '\n' +
                    'Email : ' + email + '\n' +
                    (nif ? 'NIF : ' + nif + '\n' : '') +
                    '--------------------------------\n\n' +
                    '🎲 NUMÉRO : ' + data.ticket.number + '\n' +
                    '(Lotto 5 chiffres)\n\n' +
                    '================================\n' +
                    'Ce ticket est gratuit - Bonne chance !\n' +
                    'MERCI POUR VOTRE CONFIANCE !\n' +
                    '================================\n';

                var printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(
                        '<html><head><title>Ticket Gratuit ' + data.ticket.id + '</title>' +
                        '<style>body{font-family:monospace;padding:20px;}pre{font-size:14px;}</style>' +
                        '</head><body><pre>' + ticketText + '</pre>' +
                        '<button onclick="window.print();setTimeout(function(){window.close();},500);">🖨️ Imprimer</button>' +
                        '</body></html>'
                    );
                    printWindow.document.close();
                } else {
                    alert('⚠️ Autorisez les pop-ups pour imprimer le ticket gratuit.');
                }

                // Réinitialiser le formulaire
                document.getElementById('clientPrenom').value = '';
                document.getElementById('clientNom').value    = '';
                document.getElementById('clientEmail').value  = '';
                document.getElementById('clientNif').value    = '';
                loadAgentStats();
                loadTickets();

            } else {
                resultDiv.className = 'free-ticket-result error';
                resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + data.message;
            }
            setTimeout(function() {
                resultDiv.style.display = 'none';
                resultDiv.className     = 'free-ticket-result';
                resultDiv.innerHTML     = '';
            }, 5000);
        } catch(e) {
            alert('Erreur lors de l\'enregistrement du client');
            console.error(e);
        }
    };
    xhr.send(JSON.stringify({
        agentId: currentUser.id,
        clientNom: nom, clientPrenom: prenom,
        clientEmail: email, clientNif: nif
    }));
}

// ========== NAVIGATION POPUPS ==========
function showClientPage()  { document.getElementById('clientPage').style.display  = 'flex'; }
function closeClientPage() { document.getElementById('clientPage').style.display  = 'none'; }

function showTicketsPage() {
    document.getElementById('ticketsPage').style.display = 'flex';
    loadTickets();
}
function closeTicketsPage() { document.getElementById('ticketsPage').style.display = 'none'; }

// FIX: closeRapportPage était appelée dans le HTML mais non définie
function closeRapportPage() { document.getElementById('rapportPage').style.display = 'none'; }

function showRapportPage() {
    // FIX: plus de setTimeout fragile — on charge et on met à jour directement via callback
    var rapportPageEl = document.getElementById('rapportPage');
    rapportPageEl.style.display = 'flex';

    // Afficher les stats déjà en mémoire immédiatement
    updateRapportDisplay();

    // Puis recharger pour avoir les données fraîches
    if (!currentUser) return;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', API_BASE_URL + '/api/agent-stats?agentId=' + currentUser.id, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4 || xhr.status !== 200) return;
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.success) {
                agentStats = data.stats;
                if (currentUser) currentUser.balance = agentStats.balance;
                updateRapportDisplay();
            }
        } catch(e) {}
    };
    xhr.send();
}

function updateRapportDisplay() {
    if (!agentStats) return;
    setInnerHTML('rapportSales',      (agentStats.totalSales  || 0).toLocaleString() + ' GDS');
    setInnerHTML('rapportWins',       (agentStats.totalWins   || 0).toLocaleString() + ' GDS');
    setInnerHTML('rapportProfit',     (agentStats.netProfit   || 0).toLocaleString() + ' GDS');
    setInnerHTML('rapportCommission', (agentStats.commission  || 0).toLocaleString() + ' GDS');
    setInnerHTML('rapportBalance',    (agentStats.balance     || 0).toLocaleString() + ' GDS');
}

function setInnerHTML(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
}

// ========== IMPRESSION DU RAPPORT ==========
function printRapport() {
    if (!agentStats) {
        alert('Chargement des statistiques en cours, veuillez réessayer dans un instant.');
        loadAgentStats();
        return;
    }

    var content =
        '================================\n' +
        '      RAPPORT DE VENTES\n' +
        '================================\n\n' +
        'Agent : ' + (currentUser.agentName || currentUser.name) + '\n' +
        'Zone  : ' + currentUser.zone + '\n' +
        'Date  : ' + new Date().toLocaleDateString('fr-FR') + '\n' +
        'Heure : ' + new Date().toLocaleTimeString('fr-FR') + '\n' +
        '--------------------------------\n\n' +
        '💰 Ventes totales : ' + (agentStats.totalSales  || 0).toLocaleString() + ' GDS\n' +
        '🏆 Gains          : ' + (agentStats.totalWins   || 0).toLocaleString() + ' GDS\n' +
        '📈 Bénéfice net   : ' + (agentStats.netProfit   || 0).toLocaleString() + ' GDS\n' +
        '💵 Commission     : ' + (agentStats.commission  || 0).toLocaleString() + ' GDS\n' +
        '💰 Solde actuel   : ' + (agentStats.balance     || 0).toLocaleString() + ' GDS\n\n' +
        '================================\n' +
        'Document généré par Borlette Pro\n' +
        '================================\n';

    var printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('⚠️ Autorisez les pop-ups pour imprimer le rapport.');
        return;
    }
    printWindow.document.write(
        '<html><head><title>Rapport Borlette</title>' +
        '<style>body{font-family:monospace;padding:20px;}pre{font-size:14px;}</style>' +
        '</head><body><pre>' + content + '</pre>' +
        '<button onclick="window.print();setTimeout(function(){window.close();},500);">🖨️ Imprimer</button>' +
        '</body></html>'
    );
    printWindow.document.close();
}

// ========== MODE SOMBRE ==========
function initDarkMode() {
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
        var btn = document.getElementById('darkModeToggle');
        if (btn) btn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleDarkMode() {
    var btn = document.getElementById('darkModeToggle');
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

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', function() {
    initDarkMode();

    var toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleDarkMode);

    // Entrée pour ajouter un numéro
    var inputNumber = document.getElementById('inputNumber');
    var inputAmount = document.getElementById('inputAmount');
    if (inputNumber) inputNumber.addEventListener('keypress', function(e) { if (e.key === 'Enter') addNumber(); });
    if (inputAmount) inputAmount.addEventListener('keypress', function(e) { if (e.key === 'Enter') addNumber(); });

    // Entrée pour se connecter
    var usernameInput = document.getElementById('username');
    var passwordInput = document.getElementById('password');
    function handleEnter(e) { if (e.key === 'Enter') { e.preventDefault(); login(); } }
    if (usernameInput) usernameInput.addEventListener('keypress', handleEnter);
    if (passwordInput) passwordInput.addEventListener('keypress', handleEnter);
});

// toggleMenu gardé vide pour compatibilité (bouton retiré du HTML corrigé)
function toggleMenu() {}