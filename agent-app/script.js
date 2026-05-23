// URL de l'API
var API_BASE_URL = window.location.origin;

var currentUser = null;
var currentItems = [];
var currentTicketTab = 'all';
var agentStats = null;

// ========== GESTION DU CODE PIN ET DE L'APPAREIL ==========
var deviceId = localStorage.getItem('deviceId');
if (!deviceId) {
    deviceId = 'POS-' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('deviceId', deviceId);
}

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
    var url = API_BASE_URL + '/api/verify-pos-pin';
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
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
                    alert('Erreur de traitement');
                    if (callback) callback(false);
                }
            } else {
                alert('❌ Erreur de vérification.');
                if (callback) callback(false);
            }
        }
    };
    xhr.send(JSON.stringify({ pinCode: storedPin, deviceId: deviceId, posName: 'POS-' + deviceId.substring(0, 8) }));
}

function checkDeviceAuthorization(callback) {
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/check-device';
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (callback) callback(data.authorized !== false);
                } catch(e) {
                    if (callback) callback(true);
                }
            } else {
                if (callback) callback(true);
            }
        }
    };
    xhr.send(JSON.stringify({ deviceId: deviceId }));
}

function updateDate() {
    var dateElement = document.getElementById('currentDate');
    if (dateElement) {
        var now = new Date();
        dateElement.textContent = now.toLocaleDateString('fr-FR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
}

function login() {
    var username = document.getElementById('username').value;
    var password = document.getElementById('password').value;
    
    verifyPOSPin(function(isPinValid) {
        if (!isPinValid) return;
        
        var xhr = new XMLHttpRequest();
        var url = API_BASE_URL + '/api/login';
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if (data.success && !data.user.isAdmin) {
                        currentUser = data.user;
                        document.getElementById('agentInfo').innerHTML = 
                            '<div class="agent-name"><i class="fas fa-user-circle"></i> ' + (currentUser.agentName || currentUser.name) + '</div>' +
                            '<div class="agent-zone"><i class="fas fa-map-marker-alt"></i> ' + currentUser.zone + '</div>' +
                            '<div class="agent-type"><i class="fas fa-tag"></i> ' + (currentUser.type === 'supervisor' ? 'Superviseur' : 'Vendeur') + '</div>';
                        
                        if (currentUser.isBlocked) {
                            document.getElementById('blockedAlert').style.display = 'block';
                        }
                        
                        document.getElementById('loginPage').style.display = 'none';
                        document.getElementById('appPage').style.display = 'block';
                        
                        updateDate();
                        setInterval(updateDate, 60000);
                        
                        loadAgentStats();
                        loadTickets();
                        
                        setInterval(function() {
                            if (currentUser) {
                                loadAgentStats();
                                loadTickets();
                            }
                        }, 30000);
                    } else {
                        document.getElementById('errorMsg').textContent = data.message || 'Identifiants incorrects';
                        document.getElementById('errorMsg').style.display = 'block';
                    }
                } catch(e) {
                    document.getElementById('errorMsg').textContent = 'Erreur de traitement';
                    document.getElementById('errorMsg').style.display = 'block';
                }
            } else {
                document.getElementById('errorMsg').textContent = 'Erreur de connexion au serveur';
                document.getElementById('errorMsg').style.display = 'block';
            }
        };
        xhr.send(JSON.stringify({ username: username, password: password, deviceId: deviceId }));
    });
}

function makeDeposit() {
    var paymentPointId = parseInt(document.getElementById('depositPointId').value);
    var amount = parseInt(document.getElementById('depositAmount').value);
    var notes = document.getElementById('depositNotes').value;
    
    if (!paymentPointId || !amount || amount <= 0) {
        alert('Veuillez remplir tous les champs correctement');
        return;
    }
    
    if (amount > (currentUser.balance || 0)) {
        alert('Solde insuffisant. Votre solde actuel est de ' + (currentUser.balance || 0).toLocaleString() + ' GDS');
        return;
    }
    
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/deposit';
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                var resultDiv = document.getElementById('depositResult');
                if (data.success) {
                    resultDiv.className = 'deposit-result success';
                    resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> ✅ Déchargement effectué ! Nouveau solde: ' + data.newBalance.toLocaleString() + ' GDS';
                    document.getElementById('depositAmount').value = '';
                    document.getElementById('depositNotes').value = '';
                    loadAgentStats();
                } else {
                    resultDiv.className = 'deposit-result error';
                    resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ ' + data.message;
                }
                setTimeout(function() {
                    resultDiv.style.display = 'none';
                    resultDiv.className = 'deposit-result';
                }, 3000);
            } catch(e) {}
        }
    };
    xhr.send(JSON.stringify({ agentId: currentUser.id, amount: amount, paymentPointId: paymentPointId, notes: notes }));
}

function addNumber() {
    var number = document.getElementById('inputNumber').value.trim();
    var amount = parseInt(document.getElementById('inputAmount').value);
    var ticketType = document.getElementById('inputType').value;
    
    if (!number) {
        alert('Entrez un numéro');
        return;
    }
    
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
        container.innerHTML = '<p class="empty-message"><i class="fas fa-inbox"></i> Aucun numéro sélectionné</p>';
    } else {
        var html = '';
        for (var i = 0; i < currentItems.length; i++) {
            var item = currentItems[i];
            var typeText = item.ticketType === 'simple' ? '2 chiffres' : (item.ticketType === 'three' ? '3 chiffres' : '5 chiffres');
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

function printTicket() {
    if (currentItems.length === 0) {
        alert('Ajoutez au moins un numéro');
        return;
    }
    
    if (currentUser.isBlocked) {
        alert('Votre POS est bloqué. Vous ne pouvez pas effectuer de ventes.');
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
                    alert('✅ Vente enregistrée ! Ticket N°: ' + ticket.id + '\nTotal: ' + total + ' GDS');
                    currentItems = [];
                    updateItemsDisplay();
                    document.getElementById('ticketNotes').value = '';
                    loadAgentStats();
                    loadTickets();
                } else {
                    alert('❌ ' + data.message);
                }
            } catch(e) {
                alert('Erreur lors de l\'enregistrement');
            }
        }
    };
    xhr.send(JSON.stringify({ agentId: currentUser.id, items: currentItems, drawingName: drawingName, notes: notes }));
}

function cancelTicket() {
    var ticketId = document.getElementById('cancelTicketId').value.trim();
    var reason = document.getElementById('cancelReason').value.trim() || 'Annulation client';
    
    if (!ticketId) {
        alert('Entrez le numéro du ticket à annuler');
        return;
    }
    
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/cancel-ticket';
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                var resultDiv = document.getElementById('cancelResult');
                if (data.success) {
                    resultDiv.className = 'cancel-result success';
                    resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> ✅ ' + data.message;
                    document.getElementById('cancelTicketId').value = '';
                    document.getElementById('cancelReason').value = '';
                    loadAgentStats();
                    loadTickets();
                } else {
                    resultDiv.className = 'cancel-result error';
                    resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ❌ ' + data.message;
                }
                setTimeout(function() {
                    resultDiv.style.display = 'none';
                    resultDiv.className = 'cancel-result';
                }, 3000);
            } catch(e) {}
        }
    };
    xhr.send(JSON.stringify({ ticketId: ticketId, agentId: currentUser.id, reason: reason }));
}

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
                    document.getElementById('statSales').textContent = agentStats.totalSales.toLocaleString() + ' GDS';
                    document.getElementById('statWins').textContent = agentStats.totalWins.toLocaleString() + ' GDS';
                    document.getElementById('statProfit').textContent = agentStats.netProfit.toLocaleString() + ' GDS';
                    document.getElementById('statCommission').textContent = agentStats.commission.toLocaleString() + ' GDS';
                    document.getElementById('statBalance').textContent = (agentStats.balance || 0).toLocaleString() + ' GDS';
                    if (currentUser) currentUser.balance = agentStats.balance;
                }
            } catch(e) {}
        }
    };
    xhr.send();
}

function loadTickets() {
    if (!currentUser) return;
    
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/agent-tickets?agentId=' + currentUser.id;
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4 && xhr.status === 200) {
            try {
                var data = JSON.parse(xhr.responseText);
                if (data.success) {
                    var tickets = data.tickets;
                    
                    if (currentTicketTab === 'winners') {
                        tickets = tickets.filter(function(t) { return t.isWinner || t.is_winner; });
                    } else if (currentTicketTab === 'cancelled') {
                        tickets = tickets.filter(function(t) { return t.isCancelled || t.is_cancelled; });
                    } else {
                        tickets = tickets.filter(function(t) { return true; });
                    }
                    
                    displayTickets(tickets);
                }
            } catch(e) {}
        }
    };
    xhr.send();
}

function displayTickets(tickets) {
    var container = document.getElementById('ticketsList');
    
    if (tickets.length === 0) {
        container.innerHTML = '<p class="empty-message"><i class="fas fa-inbox"></i> Aucun ticket</p>';
        return;
    }
    
    var html = '';
    for (var i = 0; i < tickets.length; i++) {
        var t = tickets[i];
        var statusClass = '';
        var statusBadge = '';
        
        var isCancelled = t.isCancelled || t.is_cancelled;
        var isWinner = t.isWinner || t.is_winner;
        var isFreeTicket = t.is_free_ticket === true;
        var winAmount = t.winAmount || t.win_amount || 0;
        
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
            var freeNumber = t.items && t.items[0] ? t.items[0].number : '???';
            itemsList = '<div class="ticket-item-detail free-number"><span class="item-number-ticket">' + freeNumber + '</span> <span class="item-type-ticket">(Lotto 5 chiffres - OFFERT)</span></div>';
        } else if (t.items) {
            for (var j = 0; j < t.items.length; j++) {
                var item = t.items[j];
                var typeText = item.ticketType === 'simple' ? '2ch' : (item.ticketType === 'three' ? '3ch' : '5ch');
                var typeClass = item.ticketType === 'simple' ? 'type-simple' : (item.ticketType === 'three' ? 'type-three' : 'type-five');
                itemsList += '<div class="ticket-item-detail ' + typeClass + '"><span class="item-number-ticket">' + item.number + '</span> <span class="item-type-ticket">(' + typeText + ')</span> : ' + item.amount.toLocaleString() + ' GDS</div>';
            }
        } else {
            itemsList = '<div>Numéro: ' + t.number + ' : ' + t.amount + ' GDS</div>';
        }
        
        var totalAmount = t.totalAmount || t.total_amount || t.amount || 0;
        var drawingName = t.drawingName || t.drawing_name;
        var ticketDate = t.date;
        var notes = t.notes;
        var cancelReason = t.cancelReason || t.cancel_reason;
        var cancelledAt = t.cancelledAt || t.cancelled_at;
        
        var clientInfo = '';
        if (isFreeTicket && (t.client_nom || t.client_prenom)) {
            clientInfo = '<div><i class="fas fa-user"></i> Client: ' + (t.client_prenom || '') + ' ' + (t.client_nom || '') + '</div>';
        }
        
        html += '<div class="ticket-item ' + statusClass + '">' +
            '<div class="ticket-header">' +
                '<strong><i class="fas fa-ticket-alt"></i> ' + t.id + '</strong>' +
                statusBadge +
            '</div>' +
            '<div class="ticket-items">' + itemsList + '</div>' +
            '<div class="ticket-footer">' +
                '<div><strong>Total: ' + totalAmount.toLocaleString() + ' GDS</strong></div>' +
                '<div><i class="fas fa-calendar-alt"></i> Tirage: ' + drawingName + '</div>' +
                '<div><i class="fas fa-clock"></i> Date: ' + new Date(ticketDate).toLocaleString() + '</div>' +
                clientInfo +
                (notes ? '<div><i class="fas fa-sticky-note"></i> Notes: ' + notes + '</div>' : '') +
                (isCancelled ? '<div class="cancel-info"><i class="fas fa-info-circle"></i> Annulé le: ' + new Date(cancelledAt).toLocaleString() + '<br>Motif: ' + cancelReason + '</div>' : '') +
            '</div>' +
        '</div>';
    }
    container.innerHTML = html;
}
function canCancelTicket(ticketDate) {
    var ticketTime = new Date(ticketDate).getTime();
    var now = new Date().getTime();
    var diffMinutes = (now - ticketTime) / (1000 * 60);
    return diffMinutes <= 10;
}

function cancelTicketWithTimeLimit() {
    var ticketId = document.getElementById('cancelTicketId').value.trim();
    var reason = document.getElementById('cancelReason').value.trim() || 'Annulation client';
    
    if (!ticketId) {
        alert('Entrez le numéro du ticket à annuler');
        return;
    }
    
    // Récupérer d'abord les tickets de l'agent
    var xhr = new XMLHttpRequest();
    var url = API_BASE_URL + '/api/agent-tickets?agentId=' + currentUser.id;
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                try {
                    var data = JSON.parse(xhr.responseText);
                    var ticket = null;
                    for (var i = 0; i < data.tickets.length; i++) {
                        if (data.tickets[i].id === ticketId) {
                            ticket = data.tickets[i];
                            break;
                        }
                    }
                    
                    if (!ticket) {
                        alert('Ticket non trouvé');
                        return;
                    }
                    
                    // Vérifier le délai de 10 minutes
                    var ticketTime = new Date(ticket.date).getTime();
                    var now = new Date().getTime();
                    var diffMinutes = (now - ticketTime) / (1000 * 60);
                    
                    if (diffMinutes > 10) {
                        alert('❌ Délai dépassé ! Ce ticket ne peut plus être annulé (délai de 10 minutes).');
                        return;
                    }
                    
                    // Procéder à l'annulation
                    var cancelXhr = new XMLHttpRequest();
                    var cancelUrl = API_BASE_URL + '/api/cancel-ticket';
                    cancelXhr.open('PUT', cancelUrl, true);
                    cancelXhr.setRequestHeader('Content-Type', 'application/json');
                    cancelXhr.onreadystatechange = function() {
                        if (cancelXhr.readyState === 4) {
                            var resultDiv = document.getElementById('cancelResult');
                            if (cancelXhr.status === 200) {
                                try {
                                    var cancelData = JSON.parse(cancelXhr.responseText);
                                    if (cancelData.success) {
                                        resultDiv.className = 'cancel-result success';
                                        resultDiv.innerHTML = '<i class="fas fa-check-circle"></i> ✅ ' + cancelData.message;
                                        document.getElementById('cancelTicketId').value = '';
                                        document.getElementById('cancelReason').value = '';
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
                            setTimeout(function() {
                                resultDiv.style.display = 'none';
                                resultDiv.className = 'cancel-result';
                            }, 3000);
                        }
                    };
                    cancelXhr.send(JSON.stringify({ ticketId: ticketId, agentId: currentUser.id, reason: reason }));
                } catch(e) {
                    alert('Erreur lors de la vérification du ticket');
                }
            } else {
                alert('Erreur de connexion pour vérifier le ticket');
            }
        }
    };
    xhr.send();
}

function showTicketTab(tab) {
    currentTicketTab = tab;
    var btns = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < btns.length; i++) {
        btns[i].classList.remove('active');
    }
    if (window.event && window.event.target) {
        window.event.target.classList.add('active');
    }
    loadTickets();
}

function registerClientAndGetFreeTicket() {
    var prenom = document.getElementById('clientPrenom').value.trim();
    var nom = document.getElementById('clientNom').value.trim();
    var email = document.getElementById('clientEmail').value.trim();
    var nif = document.getElementById('clientNif').value.trim();
    
    if (!prenom || !nom) {
        alert('Veuillez entrer au moins le prénom et le nom du client');
        return;
    }
    
    if (!email) {
        alert('Veuillez entrer l\'email du client');
        return;
    }
    
    if (currentUser.isBlocked) {
        alert('Votre POS est bloqué. Vous ne pouvez pas effectuer cette action.');
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
                    resultDiv.className = 'free-ticket-result success';
                    resultDiv.innerHTML = '<i class="fas fa-gift"></i> <strong>Ticket gratuit offert !</strong><br>Numéro: <span style="font-size: 20px; font-weight: bold;">' + data.ticket.number + '</span><br>ID Ticket: ' + data.ticket.id;
                    
                    // Générer le texte du ticket gratuit pour impression
                    var ticketText = '';
                    ticketText += '================================\n';
                    ticketText += '      TICKET GRATUIT\n';
                    ticketText += '================================\n\n';
                    ticketText += 'Ticket N°: ' + data.ticket.id + '\n';
                    ticketText += 'Offert à: ' + prenom + ' ' + nom + '\n';
                    ticketText += 'Email: ' + email + '\n';
                    if (nif) ticketText += 'NIF: ' + nif + '\n';
                    ticketText += '--------------------------------\n\n';
                    ticketText += '🎲 NUMÉRO GAGNANT: ' + data.ticket.number + '\n';
                    ticketText += '(Lotto 5 chiffres)\n\n';
                    ticketText += '================================\n';
                    ticketText += 'Ce ticket est gratuit - Bonne chance !\n';
                    ticketText += 'MERCI POUR VOTRE CONFIANCE !\n';
                    ticketText += '================================\n';
                    
                    // Créer une fenêtre d'impression
                    var printWindow = window.open('', '_blank');
                    printWindow.document.write('<html><head>');
                    printWindow.document.write('<title>Ticket Gratuit - ' + data.ticket.id + '</title>');
                    printWindow.document.write('<style>');
                    printWindow.document.write('body { font-family: monospace; padding: 20px; margin: 0; }');
                    printWindow.document.write('pre { font-size: 14px; margin: 0; white-space: pre; }');
                    printWindow.document.write('</style>');
                    printWindow.document.write('</head><body>');
                    printWindow.document.write('<pre>' + ticketText + '</pre>');
                    printWindow.document.write('</body></html>');
                    printWindow.document.close();
                    
                    // Déclencher l'impression
                    printWindow.print();
                    
                    // Fermer après impression
                    setTimeout(function() {
                        printWindow.close();
                    }, 1000);
                    
                    document.getElementById('clientPrenom').value = '';
                    document.getElementById('clientNom').value = '';
                    document.getElementById('clientEmail').value = '';
                    document.getElementById('clientNif').value = '';
                    loadAgentStats();
                    loadTickets();
                } else {
                    resultDiv.className = 'free-ticket-result error';
                    resultDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + data.message;
                }
                setTimeout(function() {
                    resultDiv.style.display = 'none';
                    resultDiv.className = 'free-ticket-result';
                }, 5000);
            } catch(e) {
                console.error('Erreur:', e);
                alert('Erreur lors de l\'enregistrement');
            }
        }
    };
    xhr.send(JSON.stringify({ agentId: currentUser.id, clientNom: nom, clientPrenom: prenom, clientEmail: email, clientNif: nif }));
}

function logout() {
    currentUser = null;
    currentItems = [];
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('appPage').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function toggleMenu() {}

function showClientPage() {
    document.getElementById('clientPage').style.display = 'flex';
}

function closeClientPage() {
    document.getElementById('clientPage').style.display = 'none';
}

function showTicketsPage() {
    document.getElementById('ticketsPage').style.display = 'flex';
    loadTickets();
}

function closeTicketsPage() {
    document.getElementById('ticketsPage').style.display = 'none';
}

function showRapportPage() {
    // Recharger les stats
    loadAgentStats();
    
    setTimeout(function() {
        // Utiliser agentStats directement
        if (agentStats) {
            document.getElementById('rapportSales').innerHTML = (agentStats.totalSales || 0).toLocaleString() + ' GDS';
            document.getElementById('rapportWins').innerHTML = (agentStats.totalWins || 0).toLocaleString() + ' GDS';
            document.getElementById('rapportProfit').innerHTML = (agentStats.netProfit || 0).toLocaleString() + ' GDS';
            document.getElementById('rapportCommission').innerHTML = (agentStats.commission || 0).toLocaleString() + ' GDS';
            document.getElementById('rapportBalance').innerHTML = (agentStats.balance || 0).toLocaleString() + ' GDS';
        }
        
        document.getElementById('rapportPage').style.display = 'flex';
    }, 500);
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

function initDarkMode() {
    var darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
        var toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleDarkMode() {
    var toggleBtn = document.getElementById('darkModeToggle');
    if (document.body.classList.contains('dark-mode')) {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('darkMode', 'disabled');
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
    } else {
        document.body.classList.add('dark-mode');
        localStorage.setItem('darkMode', 'enabled');
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    initDarkMode();
    var toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleDarkMode);
    
    var inputNumber = document.getElementById('inputNumber');
    var inputAmount = document.getElementById('inputAmount');
    
    if (inputNumber) {
        inputNumber.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') addNumber();
        });
    }
    
    if (inputAmount) {
        inputAmount.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') addNumber();
        });
    }
    
    var usernameInput = document.getElementById('username');
    var passwordInput = document.getElementById('password');
    
    function handleEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            login();
        }
    }
    
    if (usernameInput) usernameInput.addEventListener('keypress', handleEnter);
    if (passwordInput) passwordInput.addEventListener('keypress', handleEnter);
});