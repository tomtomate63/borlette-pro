// admin-app/script.js - Version complète corrigée
const API_BASE_URL = window.location.origin;

let currentAdmin = null;
let pettyCashBalance = 0;

// ========== FONCTIONS DE CONNEXION ==========
async function adminLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showLoginError('Veuillez entrer vos identifiants');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            const isAdminUser = data.user.isAdmin === true || 
                                data.user.is_admin === true || 
                                data.user.username === 'admin' ||
                                data.user.type === 'admin';
            
            if (!isAdminUser) {
                showLoginError('Accès non autorisé - Compte non administrateur');
                return;
            }
            
            currentAdmin = data.user;
            document.getElementById('adminInfo').innerHTML = `<i class="fas fa-user-shield"></i> ${currentAdmin.name || currentAdmin.username}`;
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminPage').style.display = 'flex';
            
            await loadAllData();
            
            showSection('dashboard', null);
        } else {
            showLoginError('Accès non autorisé - Identifiants admin requis');
        }
    } catch (error) {
        console.error('Erreur connexion:', error);
        showLoginError('Erreur de connexion au serveur');
    }
}

function showLoginError(message) {
    const errorDiv = document.getElementById('loginError');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 3000);
}

function adminLogout() {
    currentAdmin = null;
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminPage').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ========== FONCTION SHOW SECTION ==========
function showSection(section, event) {
    document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
    
    const targetSection = document.getElementById(`${section}Section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) {
        const clickedBtn = event.target.closest('.nav-btn');
        if (clickedBtn) clickedBtn.classList.add('active');
    }
    
    const titles = {
        dashboard: 'Tableau de bord',
        enregistrement: '📋 ENREGISTREMENT - Nouveaux utilisateurs et points',
        utilisateurs: 'Gestion des utilisateurs',
        pins: '🔐 Gestion des PINs',
        pointsVente: 'Points de vente',
        limitesBoules: 'Limites de boules',
        rapports: '📊 RAPPORTS',
        transactions: 'Transactions',
        tickets: 'Tickets',
        controlePaiement: 'Contrôle paiement',
        commissions: 'Commissions',
        tirages: 'Gestion des tirages',
        pettyCash: '💰 Petite Caisse'
    };
    document.getElementById('sectionTitle').textContent = titles[section] || section;
    
    if (section === 'dashboard') loadDashboard();
    if (section === 'utilisateurs') loadUsers();
    if (section === 'pointsVente') loadPaymentPoints();
    if (section === 'limitesBoules') loadLimits();
    if (section === 'rapports') loadReports();
    if (section === 'transactions') loadTransactions();
    if (section === 'tickets') loadAllTickets();
    if (section === 'controlePaiement') loadPaymentControl();
    if (section === 'commissions') loadCommissions();
    if (section === 'tirages') loadDrawingsHistory();
    if (section === 'pettyCash') loadPettyCash();
    if (section === 'pins') loadPinsSection();
    
    closeSidebarAfterClick();
}

async function loadAllData() {
    await loadDashboard();
    await loadUsers();
    await loadPaymentPoints();
    await loadLimits();
    await loadReports();
    await loadTransactions();
    await loadAllTickets();
    await loadPaymentControl();
    await loadCommissions();
    await loadDrawingsHistory();
    await loadPettyCash();
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    try {
        let statsData;
        try {
            const fullRes = await fetch(`${API_BASE_URL}/api/dashboard-full`);
            const fullData = await fullRes.json();
            if (fullData.success) {
                statsData = fullData;
            } else {
                throw new Error('API non disponible');
            }
        } catch (e) {
            const statsRes = await fetch(`${API_BASE_URL}/api/stats`);
            statsData = await statsRes.json();
        }
        
        if (statsData.success) {
            document.getElementById('totalSales').innerHTML = (statsData.stats.totalSales || 0).toLocaleString() + ' GDS';
            document.getElementById('totalWins').innerHTML = (statsData.stats.totalWins || 0).toLocaleString() + ' GDS';
            document.getElementById('totalCommission').innerHTML = (statsData.stats.totalCommission || 0).toLocaleString() + ' GDS';
            document.getElementById('netProfit').innerHTML = (statsData.stats.netProfit || 0).toLocaleString() + ' GDS';
        }
        
        const zoneRes = await fetch(`${API_BASE_URL}/api/reports/by-zone`);
        const zoneData = await zoneRes.json();
        
        if (zoneData.success && zoneData.report) {
            let zoneHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Zone</th><th>Ventes</th><th>Gains</th><th>Commissions</th><th>Bénéfice</th></tr></thead><tbody>';
            for (const [zone, data] of Object.entries(zoneData.report)) {
                zoneHtml += `<tr>
                    <td><strong>${zone}</strong></td>
                    <td>${(data.totalSales || 0).toLocaleString()} GDS</td>
                    <td>${(data.totalWins || 0).toLocaleString()} GDS</td>
                    <td>${(data.totalCommission || 0).toLocaleString()} GDS</td>
                    <td>${(data.netProfit || 0).toLocaleString()} GDS</td>
                </tr>`;
            }
            zoneHtml += '</tbody></table></div>';
            document.getElementById('zoneStats').innerHTML = zoneHtml;
        } else {
            document.getElementById('zoneStats').innerHTML = '<p>Aucune donnée disponible</p>';
        }
        
        const ticketsRes = await fetch(`${API_BASE_URL}/api/all-tickets`);
        const ticketsData = await ticketsRes.json();
        
        if (ticketsData.success && ticketsData.tickets) {
            const recent = ticketsData.tickets.slice(-5).reverse();
            document.getElementById('recentSales').innerHTML = recent.map(t => `
                <div class="ticket-item ${t.isCancelled ? 'cancelled' : (t.isWinner ? 'winner' : '')}">
                    <strong>${t.id}</strong><br>
                    ${t.items ? t.items.map(i => `${i.number} : ${i.amount} GDS`).join(', ') : `${t.number} : ${t.amount} GDS`}<br>
                    Agent: ${t.agentName} | Zone: ${t.zone}<br>
                    Date: ${new Date(t.date).toLocaleString()}
                    ${t.isWinner ? '<br><span class="winner-badge">Gagnant</span>' : ''}
                    ${t.isCancelled ? '<br><span class="cancelled-badge">Annulé</span>' : ''}
                </div>
            `).join('') || '<p>Aucune vente récente</p>';
        }
        
        initExportButton();
    } catch (error) {
        console.error('Erreur chargement dashboard:', error);
        document.getElementById('zoneStats').innerHTML = '<p class="error">Erreur de chargement des données</p>';
    }
}

// ========== PETITE CAISSE ==========

async function loadPettyCash() {
    try {
        const balanceRes = await fetch(`${API_BASE_URL}/api/petty-cash/balance`);
        const balanceData = await balanceRes.json();
        if (balanceData.success) {
            pettyCashBalance = balanceData.balance;
            const balanceElem = document.getElementById('pettyCashBalance');
            if (balanceElem) {
                balanceElem.innerHTML = pettyCashBalance.toLocaleString() + ' GDS';
            }
            const balanceCard = document.querySelector('#pettyCashSection .cash-balance');
            if (balanceCard) {
                if (pettyCashBalance < 1000) {
                    balanceCard.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
                } else if (pettyCashBalance < 5000) {
                    balanceCard.style.background = 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)';
                } else {
                    balanceCard.style.background = 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)';
                }
            }
        }
        
        const statsRes = await fetch(`${API_BASE_URL}/api/petty-cash/stats`);
        const statsData = await statsRes.json();
        if (statsData.success) {
            const cashInElem = document.getElementById('cashInMonth');
            const cashOutElem = document.getElementById('cashOutMonth');
            const cashTransfersElem = document.getElementById('cashTransfersMonth');
            if (cashInElem) cashInElem.innerHTML = (statsData.stats.totalTopups || 0).toLocaleString() + ' GDS';
            if (cashOutElem) cashOutElem.innerHTML = (statsData.stats.totalExpenses || 0).toLocaleString() + ' GDS';
            if (cashTransfersElem) cashTransfersElem.innerHTML = (statsData.stats.totalTransfers || 0).toLocaleString() + ' GDS';
        }
        
        await loadPettyCashTransactions();
        await updatePaymentPointsSelectForPettyCash();
        
    } catch (error) {
        console.error('Erreur chargement petite caisse:', error);
    }
}

async function loadPettyCashTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/petty-cash/transactions`);
        const data = await response.json();
        
        if (data.success && data.transactions) {
            let transactions = data.transactions;
            const search = document.getElementById('filterPettyCash')?.value.toLowerCase();
            const type = document.getElementById('filterPettyCashType')?.value;
            
            if (search) transactions = transactions.filter(t => t.description?.toLowerCase().includes(search) || t.category?.toLowerCase().includes(search));
            if (type) transactions = transactions.filter(t => t.type === type);
            
            const transactionsHtml = transactions.map(t => {
                let typeIcon = '';
                let typeClass = '';
                if (t.type === 'expense') {
                    typeIcon = '➖';
                    typeClass = 'expense';
                } else if (t.type === 'topup') {
                    typeIcon = '➕';
                    typeClass = 'topup';
                } else if (t.type === 'transfer_to_payment_point') {
                    typeIcon = '🔄';
                    typeClass = 'transfer';
                } else if (t.type === 'sync') {
                    typeIcon = '🔄';
                    typeClass = 'sync';
                } else {
                    typeIcon = '📋';
                    typeClass = 'other';
                }
                
                return `
                    <div class="petty-cash-item ${typeClass}">
                        <div class="transaction-header">
                            <span class="transaction-type">${typeIcon} ${getPettyCashTypeLabel(t.type)}</span>
                            <span class="transaction-date">${new Date(t.date).toLocaleString()}</span>
                        </div>
                        <div class="transaction-details">
                            <strong>${t.description || t.category}</strong><br>
                            Montant: ${Math.abs(t.amount).toLocaleString()} GDS<br>
                            ${t.notes ? `Notes: ${t.notes}<br>` : ''}
                            ${t.payment_point_name ? `Point: ${t.payment_point_name}<br>` : ''}
                            <small>Admin: ${t.admin_name} | Solde après: ${(t.balance_after || 0).toLocaleString()} GDS</small>
                        </div>
                    </div>
                `;
            }).join('');
            
            const container = document.getElementById('pettyCashTransactionsList');
            if (container) {
                container.innerHTML = transactionsHtml || '<p>Aucune transaction</p>';
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
        const container = document.getElementById('pettyCashTransactionsList');
        if (container) {
            container.innerHTML = '<p class="error">Erreur de chargement</p>';
        }
    }
}

function getPettyCashTypeLabel(type) {
    const labels = {
        expense: 'Dépense',
        topup: 'Rechargement',
        transfer_to_payment_point: 'Transfert vers point',
        sync: 'Synchronisation'
    };
    return labels[type] || type;
}

async function addExpense() {
    const amount = parseInt(document.getElementById('expenseAmount')?.value);
    const category = document.getElementById('expenseCategory')?.value;
    const description = document.getElementById('expenseDescription')?.value.trim();
    const notes = document.getElementById('expenseNotes')?.value;
    
    if (!amount || amount <= 0) {
        showToast('Entrez un montant valide', 'error');
        return;
    }
    
    if (!description) {
        showToast('Entrez une description', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/petty-cash/expense`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                category: category,
                description: description,
                notes: notes,
                adminName: currentAdmin?.name || currentAdmin?.username || 'Admin'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Dépense de ${amount.toLocaleString()} GDS enregistrée`, 'success');
            document.getElementById('expenseAmount').value = '';
            document.getElementById('expenseDescription').value = '';
            document.getElementById('expenseNotes').value = '';
            loadPettyCash();
            loadDashboard();
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function transferToPaymentPoint() {
    const amount = parseInt(document.getElementById('transferToPointAmount')?.value);
    const paymentPointId = parseInt(document.getElementById('transferToPointId')?.value);
    const notes = document.getElementById('transferToPointNotes')?.value;
    
    if (!amount || amount <= 0) {
        showToast('Entrez un montant valide', 'error');
        return;
    }
    
    if (!paymentPointId) {
        showToast('Sélectionnez un point de paiement', 'error');
        return;
    }
    
    if (amount > pettyCashBalance) {
        showToast(`Solde insuffisant. Solde actuel: ${pettyCashBalance.toLocaleString()} GDS`, 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/petty-cash/transfer-to-payment-point`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                paymentPointId: paymentPointId,
                notes: notes,
                adminName: currentAdmin?.name || currentAdmin?.username || 'Admin'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ ${amount.toLocaleString()} GDS transférés au point de paiement`, 'success');
            document.getElementById('transferToPointAmount').value = '';
            document.getElementById('transferToPointNotes').value = '';
            loadPettyCash();
            loadPaymentPoints();
            loadTransactions();
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function topupPettyCash() {
    const amount = parseInt(document.getElementById('topupAmount')?.value);
    const source = document.getElementById('topupSource')?.value;
    const notes = document.getElementById('topupNotes')?.value;
    
    if (!amount || amount <= 0) {
        showToast('Entrez un montant valide', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/petty-cash/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                source: source,
                notes: notes,
                adminName: currentAdmin?.name || currentAdmin?.username || 'Admin'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ ${amount.toLocaleString()} GDS ajoutés à la petite caisse`, 'success');
            document.getElementById('topupAmount').value = '';
            document.getElementById('topupNotes').value = '';
            loadPettyCash();
            loadDashboard();
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

   
async function topupFromProfit() {
    const amount = parseInt(document.getElementById('topupFromProfitAmount').value);
    const notes = document.getElementById('topupFromProfitNotes').value;
    
    if (!amount || amount <= 0) {
        showToast('Entrez un montant valide', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/petty-cash/topup-from-profit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                notes: notes,
                adminName: currentAdmin?.name || currentAdmin?.username || 'Admin'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(data.message, 'success');
            document.getElementById('topupFromProfitAmount').value = '';
            document.getElementById('topupFromProfitNotes').value = '';
            loadPettyCash();
            loadDashboard(); // Pour mettre à jour l'affichage du bénéfice net
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function updatePaymentPointsSelectForPettyCash() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payment-points`);
        const data = await response.json();
        
        console.log('Points de paiement chargés:', data);
        
        if (data.success && data.paymentPoints) {
            const activePoints = data.paymentPoints.filter(p => p.isActive === true);
            const select = document.getElementById('transferToPointId');
            
            if (select) {
                if (activePoints.length > 0) {
                    select.innerHTML = activePoints.map(p => `<option value="${p.id}">${p.nom} - Solde: ${(p.balance || 0).toLocaleString()} GDS</option>`).join('');
                } else {
                    select.innerHTML = '<option value="">Aucun point actif - Créez un point dans ENREGISTREMENT</option>';
                }
            } else {
                console.error('Élément transferToPointId non trouvé dans le DOM');
            }
        } else {
            console.error('Erreur chargement points:', data);
            const select = document.getElementById('transferToPointId');
            if (select) {
                select.innerHTML = '<option value="">Erreur chargement des points</option>';
            }
        }
    } catch (error) {
        console.error('Erreur chargement points:', error);
        const select = document.getElementById('transferToPointId');
        if (select) {
            select.innerHTML = '<option value="">Erreur de connexion</option>';
        }
    }
}

// ========== EXPORT PDF ==========
async function exportToPDF(title, data, columns) {
    if (typeof window.jspdf === 'undefined' && typeof jspdf === 'undefined') {
        console.error('jsPDF non chargé');
        showToast('Bibliothèque PDF non chargée. Veuillez rafraîchir la page.', 'error');
        return;
    }
    
    const { jsPDF } = window.jspdf || jspdf;
    if (!jsPDF) {
        showToast('Erreur de chargement de jsPDF', 'error');
        return;
    }
    
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(30, 60, 114);
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleString('fr-FR');
    doc.text(`Généré le : ${dateStr}`, 14, 28);
    
    if (typeof window.jspdf !== 'undefined' && window.jspdf.autoTable) {
        window.jspdf.autoTable(doc, {
            head: [columns],
            body: data,
            startY: 35,
            theme: 'striped',
            headStyles: { fillColor: [30, 60, 114], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            margin: { left: 14, right: 14 }
        });
    } else if (typeof autoTable !== 'undefined') {
        autoTable(doc, {
            head: [columns],
            body: data,
            startY: 35,
            theme: 'striped',
            headStyles: { fillColor: [30, 60, 114], textColor: 255 },
            styles: { fontSize: 9, cellPadding: 3 },
            margin: { left: 14, right: 14 }
        });
    } else {
        doc.text("Données à exporter:", 14, 35);
        let y = 45;
        for (const row of data.slice(0, 20)) {
            doc.text(row.join(' | '), 14, y);
            y += 8;
            if (y > 270) break;
        }
    }
    
    doc.save(`${title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

function initExportButton() {
    const exportBtn = document.getElementById('exportZoneStatsBtn');
    if (exportBtn) {
        const newBtn = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newBtn, exportBtn);
        
        newBtn.addEventListener('click', async function() {
            const zoneStatsDiv = document.getElementById('zoneStats');
            const table = zoneStatsDiv.querySelector('table');
            if (table) {
                const rows = table.querySelectorAll('tr');
                if (rows.length > 1) {
                    const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.innerText);
                    const data = Array.from(rows).slice(1).map(row => 
                        Array.from(row.querySelectorAll('td')).map(cell => cell.innerText)
                    );
                    await exportToPDF('Ventes_par_zone', data, headers);
                } else {
                    showToast('Aucune donnée à exporter', 'error');
                }
            } else {
                showToast('Aucune donnée à exporter', 'error');
            }
        });
    }
}

// ========== UTILISATEURS ==========
async function loadUsers() {
    try {
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        
        if (agentsData.success && agentsData.agents) {
            const agentsHtml = agentsData.agents.map(a => `
                <tr>
                    <td>${a.id}</td>
                    <td><strong>${a.agentName || a.name || a.username}</strong><br><small>${a.username}</small></td>
                    <td>${a.zone || '-'}</td>
                    <td>${(a.totalSales || 0).toLocaleString()} GDS</td>
                    <td>${(a.totalWins || 0).toLocaleString()} GDS</td>
                    <td class="commission-value">${(a.commission || 0).toLocaleString()} GDS</td>
                    <td>${(a.balance || 0).toLocaleString()} GDS</td>
                    <td><span class="${a.isBlocked ? 'agent-blocked' : 'agent-active'}">${a.isBlocked ? 'Bloqué' : 'Actif'}</span></td>
                    <td><button class="${a.isBlocked ? 'unblock-btn' : 'block-btn'}" onclick="toggleAgentBlock(${a.id}, ${!a.isBlocked})">${a.isBlocked ? 'Débloquer' : 'Bloquer'}</button></td>
                </tr>
            `).join('');
            
            document.getElementById('agentsList').innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>ID</th><th>Agent</th><th>Zone</th><th>Ventes</th><th>Gains</th><th>Commission</th><th>Solde</th><th>Statut</th><th>Action</th></tr></thead>
                        <tbody>${agentsHtml || '<tr><td colspan="9">Aucun agent</td></tr>'}</tbody>
                    </table>
                </div>
            `;
        }
        
        const supervisorsRes = await fetch(`${API_BASE_URL}/api/supervisors`);
        const supervisorsData = await supervisorsRes.json();
        
        if (supervisorsData.success && supervisorsData.supervisors) {
            const supervisorsHtml = supervisorsData.supervisors.map(s => `
                <tr>
                    <td>${s.id}</td>
                    <td><strong>${s.prenom} ${s.nom}</strong><br><small>${s.username}</small></td>
                    <td>${s.zone || '-'}</td>
                    <td><span class="${s.isActive ? 'agent-active' : 'agent-blocked'}">${s.isActive ? 'Actif' : 'Inactif'}</span></td>
                </tr>
            `).join('');
            
            document.getElementById('supervisorsList').innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>ID</th><th>Superviseur</th><th>Zone</th><th>Statut</th></tr></thead>
                        <tbody>${supervisorsHtml || '<tr><td colspan="4">Aucun superviseur</td></tr>'}</tbody>
                    </table>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erreur chargement utilisateurs:', error);
    }
}

async function toggleAgentBlock(agentId, block) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/toggle-agent-block`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, block })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(`Agent ${block ? 'bloqué' : 'débloqué'} avec succès`, 'success');
            loadUsers();
        } else {
            showToast('Erreur lors du blocage/déblocage', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function toggleAgentBlockById() {
    const identifier = document.getElementById('blockAgentId').value.trim();
    const action = document.getElementById('blockAction').value;
    const block = action === 'block';
    
    if (!identifier) {
        showToast('Entrez l\'identifiant de l\'agent', 'error');
        return;
    }
    
    try {
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        const agent = agentsData.agents.find(a => a.id == identifier || a.username === identifier);
        
        if (!agent) {
            showToast('Agent non trouvé', 'error');
            return;
        }
        
        await toggleAgentBlock(agent.id, block);
        document.getElementById('blockAgentId').value = '';
    } catch (error) {
        showToast('Erreur', 'error');
    }
}

// ========== POINTS DE VENTE ==========
async function loadPaymentPoints() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payment-points`);
        const data = await response.json();
        
        if (data.success && data.paymentPoints) {
            const pointsHtml = data.paymentPoints.map(p => `
                <tr>
                    <td>${p.id}</td>
                    <td><strong>${p.nom}</strong></td>
                    <td>${p.adresse || '-'}</td>
                    <td>${p.departement || '-'}</td>
                    <td>${p.zone}</td>
                    <td>${(p.balance || 0).toLocaleString()} GDS</td>
                    <td><span class="${p.isActive ? 'agent-active' : 'agent-blocked'}">${p.isActive ? 'Actif' : 'Inactif'}</span></td>
                    <td><button class="${p.isActive ? 'block-btn' : 'unblock-btn'}" onclick="togglePaymentPoint(${p.id}, ${!p.isActive})">${p.isActive ? 'Désactiver' : 'Activer'}</button></td>
                </tr>
            `).join('');
            
            document.getElementById('paymentPointsList').innerHTML = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead><tr><th>ID</th><th>Nom</th><th>Adresse</th><th>Département</th><th>Zone</th><th>Solde</th><th>Statut</th><th>Action</th></tr></thead>
                        <tbody>${pointsHtml || '<tr><td colspan="8">Aucun point</td></tr>'}</tbody>
                    </table>
                </div>
            `;
            
            const activePoints = data.paymentPoints.filter(p => p.isActive);
            const selects = ['depositPointId', 'transferFrom', 'transferTo', 'payPaymentPoint'];
            selects.forEach(id => {
                const select = document.getElementById(id);
                if (select) {
                    select.innerHTML = activePoints.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
                }
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function togglePaymentPoint(pointId, isActive) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/update-payment-point`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pointId, isActive })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(`Point ${isActive ? 'activé' : 'désactivé'}`, 'success');
            loadPaymentPoints();
            updatePaymentPointsSelectForPettyCash();
        } else {
            showToast('Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== CRÉATION AGENT ==========
async function createAgent() {
    const agentData = {
        username: document.getElementById('newUsername').value.trim(),
        password: document.getElementById('newPassword').value || '1234',
        prenom: document.getElementById('newPrenom').value.trim(),
        nom: document.getElementById('newNom').value.trim(),
        agentName: document.getElementById('newAgentName').value.trim() || `${document.getElementById('newPrenom').value} ${document.getElementById('newNom').value}`,
        zone: document.getElementById('newZone').value,
        dateNaissance: document.getElementById('newDateNaissance').value,
        carteIdentite: document.getElementById('newCarteIdentite').value.trim(),
        matriculeFiscale: document.getElementById('newMatriculeFiscale').value.trim(),
        permis: document.getElementById('newPermis').value.trim(),
        // 👇 AJOUTER LES PERMISSIONS 👇
        permissions: {
            can_manage_users: document.getElementById('permManageUsers').checked,
            can_view_zone_reports: document.getElementById('permViewZoneReports').checked,
            can_view_point_tickets: document.getElementById('permViewPointTickets').checked,
            can_make_deposit: document.getElementById('permMakeDeposit').checked,
            can_pay_tickets: document.getElementById('permPayTickets').checked,
            can_transfer: document.getElementById('permTransfer').checked,
            can_sell_tickets: document.getElementById('permSellTickets').checked,
            can_free_ticket: document.getElementById('permFreeTicket').checked
        }
    };
    
    if (!agentData.username || !agentData.prenom || !agentData.nom) {
        showToast('Remplissez tous les champs obligatoires', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Vendeur créé avec succès !', 'success');
            // Réinitialiser le formulaire
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '1234';
            document.getElementById('newPrenom').value = '';
            document.getElementById('newNom').value = '';
            document.getElementById('newAgentName').value = '';
            document.getElementById('newDateNaissance').value = '';
            document.getElementById('newCarteIdentite').value = '';
            document.getElementById('newMatriculeFiscale').value = '';
            document.getElementById('newPermis').value = '';
            // 👇 Réinitialiser les cases à cocher 👇
            document.getElementById('permManageUsers').checked = false;
            document.getElementById('permViewZoneReports').checked = false;
            document.getElementById('permViewPointTickets').checked = false;
            document.getElementById('permMakeDeposit').checked = false;
            document.getElementById('permPayTickets').checked = false;
            document.getElementById('permTransfer').checked = false;
            document.getElementById('permSellTickets').checked = true;  // Par défaut pour un vendeur
            document.getElementById('permFreeTicket').checked = true;   // Par défaut pour un vendeur
            loadUsers();
        } else {
            showToast(data.message || '❌ Erreur lors de la création', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== CRÉATION SUPERVISEUR ==========
async function createSupervisor() {
    const supervisorData = {
        username: document.getElementById('superUsername').value.trim(),
        password: document.getElementById('superPassword').value,
        prenom: document.getElementById('superPrenom').value.trim(),
        nom: document.getElementById('superNom').value.trim(),
        zone: document.getElementById('superZone').value,
        carteIdentite: document.getElementById('superCarteIdentite').value.trim(),
        matriculeFiscale: document.getElementById('superMatriculeFiscale').value.trim(),
        dateNaissance: document.getElementById('superDateNaissance').value
    };
    
    if (!supervisorData.username || !supervisorData.prenom || !supervisorData.nom) {
        showToast('Remplissez tous les champs obligatoires', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-supervisor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(supervisorData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Superviseur créé avec succès !', 'success');
            document.getElementById('superUsername').value = '';
            document.getElementById('superPassword').value = 'super123';
            document.getElementById('superPrenom').value = '';
            document.getElementById('superNom').value = '';
            document.getElementById('superCarteIdentite').value = '';
            document.getElementById('superMatriculeFiscale').value = '';
            document.getElementById('superDateNaissance').value = '';
            loadUsers();
        } else {
            showToast(data.message || '❌ Erreur lors de la création', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== CRÉATION POINT DE PAIEMENT ==========
async function createPaymentPoint() {
    const pointData = {
        nom: document.getElementById('pointNom').value.trim(),
        adresse: document.getElementById('pointAdresse').value.trim(),
        departement: document.getElementById('pointDepartement').value.trim(),
        zone: document.getElementById('pointZone').value.trim(),
        balance: parseInt(document.getElementById('pointBalance').value) || 0
    };
    
    if (!pointData.nom) {
        showToast('Entrez le nom du point de paiement', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-payment-point`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pointData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Point de paiement créé avec succès !', 'success');
            document.getElementById('pointNom').value = '';
            document.getElementById('pointAdresse').value = '';
            document.getElementById('pointDepartement').value = '';
            document.getElementById('pointZone').value = '';
            document.getElementById('pointBalance').value = '0';
            loadPaymentPoints();
            updatePaymentPointsSelectForPettyCash();
        } else {
            showToast(data.message || '❌ Erreur lors de la création', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== LIMITES DE BOULES ==========
async function loadLimits() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/number-limits`);
        const data = await response.json();
        
        if (data.success && data.limits) {
            const limits = data.limits;
            document.getElementById('limitsSettings').innerHTML = `
                <div class="limit-card">
                    <h4>Lottery 2 chiffres (00-99)</h4>
                    <label><input type="checkbox" id="simpleEnabled" ${limits.simple.enabled ? 'checked' : ''}> Activer les limites</label>
                    <textarea id="simpleBlocked" rows="3" placeholder="Numéros bloqués séparés par des virgules">${limits.simple.blockedNumbers.join(', ')}</textarea>
                    <button onclick="updateLimit('simple', document.getElementById('simpleEnabled').checked, document.getElementById('simpleBlocked').value)">Sauvegarder</button>
                </div>
                <div class="limit-card">
                    <h4>Lottery 3 chiffres (000-999)</h4>
                    <label><input type="checkbox" id="threeEnabled" ${limits.three.enabled ? 'checked' : ''}> Activer les limites</label>
                    <textarea id="threeBlocked" rows="3" placeholder="Numéros bloqués séparés par des virgules">${limits.three.blockedNumbers.join(', ')}</textarea>
                    <button onclick="updateLimit('three', document.getElementById('threeEnabled').checked, document.getElementById('threeBlocked').value)">Sauvegarder</button>
                </div>
                <div class="limit-card">
                    <h4>Lottery 5 chiffres (00000-99999)</h4>
                    <label><input type="checkbox" id="fiveEnabled" ${limits.five.enabled ? 'checked' : ''}> Activer les limites</label>
                    <textarea id="fiveBlocked" rows="3" placeholder="Numéros bloqués séparés par des virgules">${limits.five.blockedNumbers.join(', ')}</textarea>
                    <button onclick="updateLimit('five', document.getElementById('fiveEnabled').checked, document.getElementById('fiveBlocked').value)">Sauvegarder</button>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function updateLimit(type, enabled, blockedStr) {
    const blockedNumbers = blockedStr.split(',').map(s => s.trim()).filter(s => s);
    try {
        const response = await fetch(`${API_BASE_URL}/api/update-number-limits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, enabled, blockedNumbers })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast('Limites mises à jour', 'success');
        } else {
            showToast('Erreur lors de la mise à jour', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== RAPPORTS ==========
async function loadReports() {
    try {
        const zoneRes = await fetch(`${API_BASE_URL}/api/reports/by-zone`);
        const zoneData = await zoneRes.json();
        
        if (zoneData.success && zoneData.report) {
            let zoneHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Zone</th><th>Ventes</th><th>Gains</th><th>Commissions</th><th>Bénéfice</th><th>Agents</th></tr></thead><tbody>';
            for (const [zone, data] of Object.entries(zoneData.report)) {
                zoneHtml += `<tr>
                    <td><strong>${zone}</strong></td>
                    <td>${(data.totalSales || 0).toLocaleString()} GDS</td>
                    <td>${(data.totalWins || 0).toLocaleString()} GDS</td>
                    <td>${(data.totalCommission || 0).toLocaleString()} GDS</td>
                    <td>${(data.netProfit || 0).toLocaleString()} GDS</td>
                    <td>${data.agentsCount || 0}</td>
                </tr>`;
            }
            zoneHtml += '</tbody></table></div>';
            document.getElementById('reportsByZone').innerHTML = zoneHtml;
        }
        
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        
        if (agentsData.success && agentsData.agents) {
            let agentHtml = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Agent</th><th>Zone</th><th>Ventes</th><th>Gains</th><th>Commission</th><th>Solde</th></tr></thead><tbody>';
            agentsData.agents.forEach(a => {
                agentHtml += `<tr>
                    <td><strong>${a.agentName || a.name}</strong><br><small>${a.username}</small></td>
                    <td>${a.zone}</td>
                    <td>${(a.totalSales || 0).toLocaleString()} GDS</td>
                    <td>${(a.totalWins || 0).toLocaleString()} GDS</td>
                    <td>${(a.commission || 0).toLocaleString()} GDS</td>
                    <td>${(a.balance || 0).toLocaleString()} GDS</td>
                </tr>`;
            });
            agentHtml += '</tbody></table></div>';
            document.getElementById('reportsByAgent').innerHTML = agentHtml;
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ========== TRANSACTIONS ==========
async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`);
        const data = await response.json();
        
        if (data.success && data.transactions) {
            let transactions = data.transactions;
            const search = document.getElementById('filterTransaction')?.value.toLowerCase();
            const type = document.getElementById('filterTransactionType')?.value;
            
            if (search) transactions = transactions.filter(t => t.description?.toLowerCase().includes(search));
            if (type) transactions = transactions.filter(t => t.type === type);
            
            const transactionsHtml = transactions.map(t => `
                <div class="transaction-item ${t.type}">
                    <div class="transaction-header">
                        <span class="transaction-type">${getTransactionTypeIcon(t.type)} ${t.type.toUpperCase()}</span>
                        <span class="transaction-date">${new Date(t.date).toLocaleString()}</span>
                    </div>
                    <div class="transaction-details">
                        ${t.description || `${t.type} de ${t.amount} GDS`}
                        ${t.amount ? `<br><strong>Montant: ${Math.abs(t.amount).toLocaleString()} GDS</strong>` : ''}
                        ${t.previous_balance !== undefined ? `<br>Balance antérieure: ${t.previous_balance.toLocaleString()} GDS` : ''}
                        ${t.new_balance !== undefined ? `<br>Balance actuelle: ${t.new_balance.toLocaleString()} GDS` : ''}
                    </div>
                </div>
            `).join('');
            
            document.getElementById('transactionsList').innerHTML = transactionsHtml || '<p>Aucune transaction</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

function getTransactionTypeIcon(type) {
    const icons = { vente: '💰', dechargement: '💵', transfert: '🔄', gain: '🏆', annulation: '❌', paiement_gagnant: '💸' };
    return icons[type] || '📋';
}

// ========== TICKETS ==========
async function loadAllTickets() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/all-tickets`);
        const data = await response.json();
        
        if (data.success && data.tickets) {
            let tickets = data.tickets;
            const search = document.getElementById('searchTicket')?.value.toLowerCase();
            const zone = document.getElementById('filterZone')?.value;
            const status = document.getElementById('filterStatus')?.value;
            
            if (search) tickets = tickets.filter(t => t.id?.toLowerCase().includes(search));
            if (zone) tickets = tickets.filter(t => t.zone === zone);
            if (status === 'winner') tickets = tickets.filter(t => t.isWinner);
            else if (status === 'cancelled') tickets = tickets.filter(t => t.isCancelled);
            else if (status === 'active') tickets = tickets.filter(t => !t.isCancelled && !t.isWinner);
            
            const ticketsHtml = tickets.map(t => {
                let statusBadge = '';
                if (t.isCancelled) statusBadge = '<span class="cancelled-badge">Annulé</span>';
                else if (t.isWinner) statusBadge = `<span class="winner-badge">Gagnant ${(t.winAmount || 0).toLocaleString()} GDS ${!t.isPaid ? '⚠️ Non payé' : '✅ Payé'}</span>`;
                else statusBadge = '<span class="pending-badge">En attente</span>';
                
                const itemsHtml = t.items ? t.items.map(i => `<div>${i.number} : ${i.amount} GDS</div>`).join('') : `<div>${t.number} : ${t.amount} GDS</div>`;
                
                return `
                    <div class="ticket-item ${t.isCancelled ? 'cancelled' : (t.isWinner ? 'winner' : '')}">
                        <div class="ticket-header">
                            <strong>${t.id}</strong>
                            ${statusBadge}
                        </div>
                        <div class="ticket-items">${itemsHtml}</div>
                        <div class="ticket-footer">
                            <strong>Total: ${(t.totalAmount || t.amount || 0).toLocaleString()} GDS</strong><br>
                            Agent: ${t.agentName} | Zone: ${t.zone}<br>
                            Tirage: ${t.drawingName}<br>
                            Date: ${new Date(t.date).toLocaleString()}
                            ${t.isCancelled ? `<br><small>Annulé: ${t.cancelReason} (${new Date(t.cancelledAt).toLocaleString()})</small>` : ''}
                            ${t.isWinner && !t.isPaid ? `<br><button class="pay-btn" onclick="payTicket('${t.id}')">💰 Payer ce ticket</button>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            document.getElementById('allTicketsList').innerHTML = ticketsHtml || '<p>Aucun ticket</p>';
            
            const statusRes = await fetch(`${API_BASE_URL}/api/tickets/by-status`);
            const statusData = await statusRes.json();
            if (statusData.success) {
                document.getElementById('winningTicketsList').innerHTML = statusData.winning.length > 0 ? 
                    statusData.winning.map(t => `<div class="ticket-item winner">Ticket ${t.id} - ${(t.win_amount || 0).toLocaleString()} GDS</div>`).join('') : 
                    '<p>Aucun ticket gagnant</p>';
                document.getElementById('pendingTicketsList').innerHTML = statusData.pending.length > 0 ? 
                    statusData.pending.map(t => `<div class="ticket-item">Ticket ${t.id} - ${(t.total_amount || 0).toLocaleString()} GDS</div>`).join('') : 
                    '<p>Aucun ticket en attente</p>';
                document.getElementById('expiredTicketsList').innerHTML = statusData.expired.length > 0 ? 
                    statusData.expired.map(t => `<div class="ticket-item cancelled">Ticket ${t.id} - ${(t.total_amount || 0).toLocaleString()} GDS</div>`).join('') : 
                    '<p>Aucun ticket caduque</p>';
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function payTicket(ticketId) {
    const paymentPointId = prompt('Entrez l\'ID du point de paiement pour ce paiement:');
    if (!paymentPointId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/pay-ticket`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketId, paymentPointId: parseInt(paymentPointId) })
        });
        
        const data = await response.json();
        if (data.success) {
            showToast(`Ticket ${ticketId} marqué comme payé`, 'success');
            loadAllTickets();
            loadPaymentPoints();
        } else {
            showToast(data.message || 'Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function markTicketAsPaid() {
    const ticketId = document.getElementById('payTicketId')?.value.trim();
    const paymentPointId = document.getElementById('payPaymentPoint')?.value;
    
    if (!ticketId) {
        showToast('Entrez le numéro du ticket', 'error');
        return;
    }
    
    await payTicket(ticketId);
    if (document.getElementById('payTicketId')) document.getElementById('payTicketId').value = '';
}

// ========== CONTRÔLE PAIEMENT ==========
async function loadPaymentControl() {
    try {
        const pointsRes = await fetch(`${API_BASE_URL}/api/payment-points`);
        const pointsData = await pointsRes.json();
        
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        
        const salesByZone = {};
        if (agentsData.success && agentsData.agents) {
            agentsData.agents.forEach(agent => {
                const zone = agent.zone;
                const totalSales = agent.totalSales || 0;
                if (!salesByZone[zone]) salesByZone[zone] = 0;
                salesByZone[zone] += totalSales;
            });
        }
        
        if (pointsData.success && pointsData.paymentPoints) {
            let html = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Point de paiement</th><th>Solde actuel</th><th>Ventes de la zone</th></tr></thead><tbody>';
            pointsData.paymentPoints.forEach(p => {
                const zoneSales = salesByZone[p.zone] || 0;
                html += `<tr>
                    <td><strong>${p.nom}</strong></td>
                    <td>${(p.balance || 0).toLocaleString()} GDS</td>
                    <td>${zoneSales.toLocaleString()} GDS</td>
                </tr>`;
            });
            html += '</tbody></table></div>';
            document.getElementById('paymentControl').innerHTML = html;
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ========== COMMISSIONS ==========
async function loadCommissions() {
    try {
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        
        if (agentsData.success && agentsData.agents) {
            let html = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Agent</th><th>Zone</th><th>Commission (5%)</th><th>Total ventes</th></tr></thead><tbody>';
            agentsData.agents.forEach(a => {
                const totalSales = a.totalSales || 0;
                const commission = totalSales * 0.05;
                html += `<tr>
                    <td><strong>${a.agentName || a.name}</strong><br><small>${a.username}</small></td>
                    <td>${a.zone}</td>
                    <td class="commission-value">${commission.toLocaleString()} GDS</td>
                    <td>${totalSales.toLocaleString()} GDS</td>
                </tr>`;
            });
            html += '</tbody></table></div>';
            document.getElementById('agentCommissions').innerHTML = html;
        }
        
        const pointsRes = await fetch(`${API_BASE_URL}/api/payment-points`);
        const pointsData = await pointsRes.json();
        
        if (pointsData.success && pointsData.paymentPoints) {
            const agentsRes2 = await fetch(`${API_BASE_URL}/api/agents`);
            const agentsData2 = await agentsRes2.json();
            const commissionByZone = {};
            if (agentsData2.success && agentsData2.agents) {
                agentsData2.agents.forEach(a => {
                    const zone = a.zone;
                    const totalSales = a.totalSales || 0;
                    const commission = totalSales * 0.05;
                    if (!commissionByZone[zone]) commissionByZone[zone] = 0;
                    commissionByZone[zone] += commission;
                });
            }
            
            let html = '<div class="table-responsive"><table class="data-table"><thead><tr><th>Point de paiement</th><th>Zone</th><th>Commission totale</th></tr></thead><tbody>';
            pointsData.paymentPoints.forEach(p => {
                const zoneCommission = commissionByZone[p.zone] || 0;
                html += `<tr>
                    <td><strong>${p.nom}</strong></td>
                    <td>${p.zone}</td>
                    <td>${zoneCommission.toLocaleString()} GDS</td>
                </tr>`;
            });
            html += '</tbody></table></div>';
            document.getElementById('paymentPointCommissions').innerHTML = html;
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

// ========== TIRAGES ==========
async function loadDrawingsHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/drawings`);
        const data = await response.json();
        
        if (data.success && data.drawings) {
            const historyHtml = data.drawings.map(d => `
                <div class="history-item">
                    <strong>${d.drawing_name}</strong><br>
                    Numéro: ${d.drawing_number}<br>
                    Date: ${new Date(d.date).toLocaleString()}
                </div>
            `).join('');
            document.getElementById('drawingsHistory').innerHTML = historyHtml || '<p>Aucun tirage enregistré</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function saveDrawing() {
    const drawingName = document.getElementById('drawingSelect').value;
    const drawingNumber = document.getElementById('drawingNumber').value.trim();
    
    if (!drawingNumber) {
        showToast('Entrez le numéro gagnant', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/save-drawing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drawingName, drawingNumber })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Tirage enregistré !', 'success');
            document.getElementById('drawingNumber').value = '';
            loadDrawingsHistory();
            loadDashboard();
            loadAllTickets();
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== DÉCHARGEMENT ==========
async function makeDeposit() {
    const agentId = parseInt(document.getElementById('depositAgentId').value);
    const paymentPointId = parseInt(document.getElementById('depositPointId').value);
    const amount = parseInt(document.getElementById('depositAmount').value);
    const notes = document.getElementById('depositNotes').value;
    
    if (!agentId || !paymentPointId || !amount || amount <= 0) {
        showToast('Remplissez tous les champs correctement', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, amount, paymentPointId, notes })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`✅ Déchargement effectué ! Nouveau solde: ${data.newBalance.toLocaleString()} GDS`, 'success');
            document.getElementById('depositAgentId').value = '';
            document.getElementById('depositAmount').value = '';
            document.getElementById('depositNotes').value = '';
            loadUsers();
            loadPaymentPoints();
            loadTransactions();
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ========== TRANSFERT ==========
async function makeTransfer() {
    const fromPointId = parseInt(document.getElementById('transferFrom').value);
    const toPointId = parseInt(document.getElementById('transferTo').value);
    const amount = parseInt(document.getElementById('transferAmount').value);
    const notes = document.getElementById('transferNotes').value;
    
    if (!fromPointId || !toPointId || !amount || amount <= 0) {
        showToast('Remplissez tous les champs', 'error');
        return;
    }
    
    if (fromPointId === toPointId) {
        showToast('Impossible de transférer vers le même point', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromPointId, toPointId, amount, notes })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Transfert effectué avec succès !', 'success');
            document.getElementById('transferAmount').value = '';
            document.getElementById('transferNotes').value = '';
            loadPaymentPoints();
            loadTransactions();
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

// ==================== GESTION DES PINS ====================

let editingPinId = null;

async function loadPins() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/pos-pins`);
        const data = await response.json();
        
        const container = document.getElementById('pinsList');
        if (!container) return;
        
        if (data.success && data.pins && data.pins.length > 0) {
            let html = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Code PIN</th>
                                <th>Nom du POS</th>
                                <th>Zone</th>
                                <th>Statut</th>
                                <th>Utilisations</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const pin of data.pins) {
                const statusBadge = pin.is_active 
                    ? '<span class="agent-active">✅ Actif</span>' 
                    : '<span class="agent-blocked">❌ Inactif</span>';
                
                html += `
                    <tr id="pin-row-${pin.id}">
                        <td>${pin.id}</td>
                        <td>
                            <span id="pin-code-${pin.id}">${pin.pin_code}</span>
                            <input type="text" id="pin-code-edit-${pin.id}" value="${pin.pin_code}" style="display:none;" maxlength="8" pattern="\\d*" class="edit-input">
                        </td>
                        <td>
                            <span id="pin-name-${pin.id}">${escapeHtml(pin.pos_name)}</span>
                            <input type="text" id="pin-name-edit-${pin.id}" value="${escapeHtml(pin.pos_name)}" style="display:none;" class="edit-input">
                        </td>
                        <td>
                            <span id="pin-zone-${pin.id}">${pin.zone}</span>
                            <select id="pin-zone-edit-${pin.id}" style="display:none;" class="edit-select">
                                <option value="tabarre" ${pin.zone === 'tabarre' ? 'selected' : ''}>Tabarre</option>
                                <option value="delmas" ${pin.zone === 'delmas' ? 'selected' : ''}>Delmas</option>
                                <option value="petion-ville" ${pin.zone === 'petion-ville' ? 'selected' : ''}>Pétion-Ville</option>
                                <option value="bois-moquette" ${pin.zone === 'bois-moquette' ? 'selected' : ''}>Bois Moquette</option>
                                <option value="dezermith" ${pin.zone === 'dezermith' ? 'selected' : ''}>Dezermith</option>
                                <option value="fermathe" ${pin.zone === 'fermathe' ? 'selected' : ''}>Fermathe</option>
                                <option value="clercine" ${pin.zone === 'clercine' ? 'selected' : ''}>Clercine</option>
                                <option value="carrefour" ${pin.zone === 'carrefour' ? 'selected' : ''}>Carrefour</option>
                                <option value="gerald" ${pin.zone === 'gerald' ? 'selected' : ''}>Gerald</option>
                                <option value="fort-dimanche" ${pin.zone === 'fort-dimanche' ? 'selected' : ''}>Fort-Dimanche</option>
                            </select>
                        </td>
                        <td>${statusBadge}</td>
                        <td>${pin.used_count || 0}</td>
                        <td class="action-buttons">
                            <button class="edit-pin-btn" onclick="togglePinEdit(${pin.id})" id="edit-btn-${pin.id}">
                                <i class="fas fa-edit"></i> Modifier
                            </button>
                            <button class="save-pin-btn" onclick="savePinEdit(${pin.id})" id="save-btn-${pin.id}" style="display:none;">
                                <i class="fas fa-save"></i> Sauvegarder
                            </button>
                            <button class="cancel-pin-btn" onclick="cancelPinEdit(${pin.id})" id="cancel-btn-${pin.id}" style="display:none;">
                                <i class="fas fa-times"></i> Annuler
                            </button>
                            <button class="${pin.is_active ? 'block-btn' : 'unblock-btn'}" onclick="togglePinStatus(${pin.id}, ${!pin.is_active})">
                                <i class="fas ${pin.is_active ? 'fa-ban' : 'fa-check'}"></i> ${pin.is_active ? 'Désactiver' : 'Activer'}
                            </button>
                            <button class="delete-pin-btn" onclick="deletePin(${pin.id})">
                                <i class="fas fa-trash"></i> Supprimer
                            </button>
                        </td>
                    </tr>
                `;
            }
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="text-muted">Aucun code PIN trouvé. Créez-en un !</p>';
        }
    } catch (error) {
        console.error('Erreur chargement PINs:', error);
        const container = document.getElementById('pinsList');
        if (container) container.innerHTML = '<p class="error">Erreur de chargement des PINs</p>';
    }
}

function togglePinEdit(pinId) {
    document.getElementById(`pin-code-${pinId}`).style.display = 'none';
    document.getElementById(`pin-name-${pinId}`).style.display = 'none';
    document.getElementById(`pin-zone-${pinId}`).style.display = 'none';
    
    document.getElementById(`pin-code-edit-${pinId}`).style.display = 'inline-block';
    document.getElementById(`pin-name-edit-${pinId}`).style.display = 'inline-block';
    document.getElementById(`pin-zone-edit-${pinId}`).style.display = 'inline-block';
    
    document.getElementById(`edit-btn-${pinId}`).style.display = 'none';
    document.getElementById(`save-btn-${pinId}`).style.display = 'inline-block';
    document.getElementById(`cancel-btn-${pinId}`).style.display = 'inline-block';
}

function cancelPinEdit(pinId) {
    document.getElementById(`pin-code-${pinId}`).style.display = 'inline';
    document.getElementById(`pin-name-${pinId}`).style.display = 'inline';
    document.getElementById(`pin-zone-${pinId}`).style.display = 'inline';
    
    document.getElementById(`pin-code-edit-${pinId}`).style.display = 'none';
    document.getElementById(`pin-name-edit-${pinId}`).style.display = 'none';
    document.getElementById(`pin-zone-edit-${pinId}`).style.display = 'none';
    
    document.getElementById(`edit-btn-${pinId}`).style.display = 'inline-block';
    document.getElementById(`save-btn-${pinId}`).style.display = 'none';
    document.getElementById(`cancel-btn-${pinId}`).style.display = 'none';
}

async function savePinEdit(pinId) {
    const newPinCode = document.getElementById(`pin-code-edit-${pinId}`).value.trim();
    const newPosName = document.getElementById(`pin-name-edit-${pinId}`).value.trim();
    const newZone = document.getElementById(`pin-zone-edit-${pinId}`).value;
    
    if (!newPinCode || !/^\d{4,8}$/.test(newPinCode)) {
        showToast('Le PIN doit contenir 4 à 8 chiffres uniquement', 'error');
        return;
    }
    
    if (!newPosName) {
        showToast('Le nom du POS est requis', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/pos-pins/${pinId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pin_code: newPinCode,
                pos_name: newPosName,
                zone: newZone,
                is_active: true
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ PIN modifié avec succès', 'success');
            document.getElementById(`pin-code-${pinId}`).textContent = newPinCode;
            document.getElementById(`pin-name-${pinId}`).textContent = newPosName;
            document.getElementById(`pin-zone-${pinId}`).textContent = newZone;
            cancelPinEdit(pinId);
        } else {
            showToast(data.message || '❌ Erreur lors de la modification', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function togglePinStatus(pinId, isActive) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/pos-pins/${pinId}/toggle`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: isActive })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast(`PIN ${isActive ? 'activé' : 'désactivé'} avec succès`, 'success');
            loadPins();
        } else {
            showToast(data.message || 'Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function deletePin(pinId) {
    if (!confirm('⚠️ Êtes-vous sûr de vouloir supprimer ce PIN ? Les appareils utilisant ce PIN ne pourront plus se connecter.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/pos-pins/${pinId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ PIN supprimé avec succès', 'success');
            loadPins();
        } else {
            showToast(data.message || '❌ Erreur lors de la suppression', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function createNewPin() {
    const pinCode = document.getElementById('newPinCode').value.trim();
    const posName = document.getElementById('newPinPosName').value.trim();
    const zone = document.getElementById('newPinZone').value;
    
    if (!pinCode || !/^\d{4,8}$/.test(pinCode)) {
        showToast('Le PIN doit contenir 4 à 8 chiffres uniquement', 'error');
        return;
    }
    
    if (!posName) {
        showToast('Le nom du POS est requis', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/pos-pins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pin_code: pinCode,
                pos_name: posName,
                zone: zone
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ PIN créé avec succès !', 'success');
            document.getElementById('newPinCode').value = '';
            document.getElementById('newPinPosName').value = '';
            loadPins();
        } else {
            showToast(data.message || '❌ Erreur lors de la création', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function loadAuthorizedDevices() {
    try {
        console.log('Chargement des appareils autorisés...');
        const response = await fetch(`${API_BASE_URL}/api/authorized-devices`);
        const data = await response.json();
        
        console.log('Réponse API:', data);
        
        const container = document.getElementById('authorizedDevicesList');
        if (!container) {
            console.error('Container authorizedDevicesList non trouvé');
            return;
        }
        
        if (!data.success) {
            container.innerHTML = '<p class="error">Erreur de chargement des données</p>';
            return;
        }
        
        const activeDevices = (data.devices || []).filter(d => d.is_active === true);
        
        if (activeDevices.length > 0) {
            let html = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID Appareil</th>
                                <th>Nom du POS</th>
                                <th>Code PIN</th>
                                <th>Dernière connexion</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const device of activeDevices) {
                html += `
                    <tr>
                        <td><code>${escapeHtml(device.device_id || '-')}</code></td>
                        <td>${escapeHtml(device.pos_name || '-')}</td>
                        <td>${device.pin_code || '-'}</td>
                        <td>${device.last_seen ? new Date(device.last_seen).toLocaleString() : '-'}</td>
                        <td><button class="block-device-btn" onclick="blockDevice('${escapeHtml(device.device_id)}')">🔒 Bloquer</button></td>
                    </tr>
                `;
            }
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="text-muted">📱 Aucun appareil autorisé pour le moment.<br>Connectez-vous à l\'Agent App avec un PIN valide pour enregistrer un appareil.</p>';
        }
    } catch (error) {
        console.error('Erreur chargement appareils autorisés:', error);
        const container = document.getElementById('authorizedDevicesList');
        if (container) {
            container.innerHTML = '<p class="error">❌ Erreur de connexion au serveur</p>';
        }
    }
}

async function blockDevice(deviceId) {
    if (!confirm(`⚠️ Bloquer l'appareil ${deviceId} ? Il ne pourra plus se connecter.`)) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/block-device`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, is_active: false })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Appareil bloqué avec succès', 'success');
            await loadAuthorizedDevices();
            await loadUnauthorizedDevices();
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function unblockDevice(deviceId) {
    if (!confirm(`✅ Débloquer l'appareil ${deviceId} ? Il pourra à nouveau se connecter.`)) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/block-device`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, is_active: true })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showToast('✅ Appareil débloqué avec succès', 'success');
            await loadAuthorizedDevices();
            await loadUnauthorizedDevices();
        } else {
            showToast(data.message || '❌ Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur de connexion', 'error');
    }
}

async function loadUnauthorizedDevices() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/authorized-devices`);
        const data = await response.json();
        
        const container = document.getElementById('unauthorizedDevicesList');
        if (!container) return;
        
        if (!data.success) {
            container.innerHTML = '<p class="error">Erreur de chargement</p>';
            return;
        }
        
        const blockedDevices = (data.devices || []).filter(d => d.is_active === false);
        
        if (blockedDevices.length > 0) {
            let html = `
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>ID Appareil</th>
                                <th>Nom du POS</th>
                                <th>Dernière connexion</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            for (const device of blockedDevices) {
                html += `
                    <tr>
                        <td><code>${escapeHtml(device.device_id || '-')}</code></td>
                        <td>${escapeHtml(device.pos_name || '-')}</td>
                        <td>${device.last_seen ? new Date(device.last_seen).toLocaleString() : '-'}</td>
                        <td><button class="unblock-device-btn" onclick="unblockDevice('${escapeHtml(device.device_id)}')">🔓 Débloquer</button></td>
                    </tr>
                `;
            }
            
            html += '</tbody></table></div>';
            container.innerHTML = html;
        } else {
            container.innerHTML = '<p class="text-muted">✅ Aucun appareil bloqué</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
        const container = document.getElementById('unauthorizedDevicesList');
        if (container) container.innerHTML = '<p class="error">Erreur de chargement</p>';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadPinsSection() {
    await loadPins();
    await loadAuthorizedDevices();
    await loadUnauthorizedDevices();
}
// ========== TRANSACTIONS ADMIN - NOUVELLES FONCTIONS ==========

let currentTransactionsTab = 'admin';
let currentAdminSubTab = 'all';

function showTransactionsTab(tab) {
    currentTransactionsTab = tab;
    
    // Cacher tous les contenus
    document.getElementById('adminTransactions').style.display = 'none';
    document.getElementById('ppTransactions').style.display = 'none';
    
    // Désactiver tous les boutons
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    if (tab === 'admin') {
        document.getElementById('adminTransactions').style.display = 'block';
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
        loadAdminTransactions();
    } else {
        document.getElementById('ppTransactions').style.display = 'block';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
        loadPPTransactions();
    }
}

function showAdminSubTab(subTab) {
    currentAdminSubTab = subTab;
    
    // Désactiver tous les sous-boutons
    document.querySelectorAll('.sub-tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // Activer le bon bouton
    const btns = document.querySelectorAll('.sub-tab-btn');
    const index = { 'all': 0, 'sales': 1, 'transfers': 2, 'gains': 3, 'cancellations': 4 };
    if (btns[index[subTab]]) btns[index[subTab]].classList.add('active');
    
    loadAdminTransactions();
}

async function loadAdminTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`);
        const data = await response.json();
        
        if (data.success && data.transactions) {
            let transactions = data.transactions;
            const search = document.getElementById('filterAdminTransaction')?.value.toLowerCase();
            const date = document.getElementById('filterAdminDate')?.value;
            
            // Filtrer selon la date
            if (date) {
                transactions = transactions.filter(t => new Date(t.date).toISOString().split('T')[0] === date);
            }
            
            // Filtrer selon le sous-onglet
            switch(currentAdminSubTab) {
                case 'sales':
                    transactions = transactions.filter(t => t.type === 'vente');
                    break;
                case 'transfers':
                    transactions = transactions.filter(t => t.type === 'transfert' || t.type === 'alimentation_point');
                    break;
                case 'gains':
                    transactions = transactions.filter(t => t.type === 'gain' || t.type === 'paiement_gagnant');
                    break;
                case 'cancellations':
                    transactions = transactions.filter(t => t.type === 'annulation');
                    break;
                default:
                    break;
            }
            
            // Filtrer par recherche
            if (search) {
                transactions = transactions.filter(t => 
                    t.description?.toLowerCase().includes(search) ||
                    t.type?.toLowerCase().includes(search)
                );
            }
            
            // Calculer les totaux
            let totalVentes = 0;
            let totalGains = 0;
            let totalTransferts = 0;
            let totalAnnulations = 0;
            
            transactions.forEach(t => {
                if (t.type === 'vente') totalVentes += t.amount;
                if (t.type === 'gain' || t.type === 'paiement_gagnant') totalGains += Math.abs(t.amount);
                if (t.type === 'transfert') totalTransferts += t.amount;
                if (t.type === 'annulation') totalAnnulations += Math.abs(t.amount);
            });
            
            const html = `
                <div class="totals-bar">
                    <div class="total-item">💰 Ventes: ${totalVentes.toLocaleString()} GDS</div>
                    <div class="total-item">🏆 Gains: ${totalGains.toLocaleString()} GDS</div>
                    <div class="total-item">🔄 Transferts: ${totalTransferts.toLocaleString()} GDS</div>
                    <div class="total-item">❌ Annulations: ${totalAnnulations.toLocaleString()} GDS</div>
                </div>
                ${transactions.map(t => `
                    <div class="transaction-item ${t.type}">
                        <div class="transaction-header">
                            <span class="transaction-type">${getTransactionTypeIcon(t.type)} ${t.type.toUpperCase()}</span>
                            <span class="transaction-date">${new Date(t.date).toLocaleString()}</span>
                        </div>
                        <div class="transaction-details">
                            ${t.description || ''}
                            ${t.amount ? `<br><strong>Montant: ${Math.abs(t.amount).toLocaleString()} GDS</strong>` : ''}
                            ${t.agent_name ? `<br>Agent: ${t.agent_name}` : ''}
                            ${t.payment_point_name ? `<br>Point: ${t.payment_point_name}` : ''}
                        </div>
                    </div>
                `).join('')}
            `;
            
            document.getElementById('adminTransactionsList').innerHTML = html || '<p>Aucune transaction</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('adminTransactionsList').innerHTML = '<p class="error">Erreur de chargement</p>';
    }
}

async function loadPPTransactions() {
    try {
        // Récupérer les points de paiement
        const pointsRes = await fetch(`${API_BASE_URL}/api/payment-points`);
        const pointsData = await pointsRes.json();
        
        // Remplir le select des points
        const ppSelect = document.getElementById('filterPP');
        if (ppSelect && pointsData.success) {
            ppSelect.innerHTML = '<option value="">Tous les points</option>' + 
                pointsData.paymentPoints.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
        }
        
        // Récupérer les transactions
        const response = await fetch(`${API_BASE_URL}/api/transactions`);
        const data = await response.json();
        
        if (data.success && data.transactions) {
            let transactions = data.transactions;
            const selectedPP = document.getElementById('filterPP')?.value;
            const search = document.getElementById('filterPPTransaction')?.value.toLowerCase();
            const date = document.getElementById('filterPPDate')?.value;
            
            // Filtrer par point de paiement
            if (selectedPP) {
                transactions = transactions.filter(t => 
                    t.payment_point_id == selectedPP || 
                    t.from_point_id == selectedPP || 
                    t.to_point_id == selectedPP
                );
            }
            
            // Filtrer par date
            if (date) {
                transactions = transactions.filter(t => new Date(t.date).toISOString().split('T')[0] === date);
            }
            
            // Filtrer par recherche
            if (search) {
                transactions = transactions.filter(t => 
                    t.description?.toLowerCase().includes(search) ||
                    t.type?.toLowerCase().includes(search)
                );
            }
            
            const html = transactions.map(t => {
                let pointName = '';
                if (t.payment_point_name) pointName = t.payment_point_name;
                if (t.from_point_name) pointName = `De: ${t.from_point_name} → Vers: ${t.to_point_name}`;
                
                return `
                    <div class="transaction-item ${t.type}">
                        <div class="transaction-header">
                            <span class="transaction-type">${getTransactionTypeIcon(t.type)} ${t.type.toUpperCase()}</span>
                            <span class="transaction-date">${new Date(t.date).toLocaleString()}</span>
                        </div>
                        <div class="transaction-details">
                            ${t.description || ''}
                            ${pointName ? `<br><strong>Point:</strong> ${pointName}` : ''}
                            ${t.amount ? `<br><strong>Montant: ${Math.abs(t.amount).toLocaleString()} GDS</strong>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            
            document.getElementById('ppTransactionsList').innerHTML = html || '<p>Aucune transaction</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
        document.getElementById('ppTransactionsList').innerHTML = '<p class="error">Erreur de chargement</p>';
    }
}

// Ajouter les écouteurs d'événements pour les filtres
document.getElementById('filterAdminTransaction')?.addEventListener('input', loadAdminTransactions);
document.getElementById('filterAdminDate')?.addEventListener('change', loadAdminTransactions);
document.getElementById('filterPP')?.addEventListener('change', loadPPTransactions);
document.getElementById('filterPPTransaction')?.addEventListener('input', loadPPTransactions);
document.getElementById('filterPPDate')?.addEventListener('change', loadPPTransactions);
// ========== FONCTIONS UTILITAIRES ==========
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle')}"></i> ${message}`;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        background: ${type === 'success' ? '#28a745' : (type === 'error' ? '#dc3545' : '#17a2b8')};
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========== MENU MOBILE ==========
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
}

function closeSidebarAfterClick() {
    if (window.innerWidth <= 768) {
        setTimeout(() => closeSidebar(), 300);
    }
}

// ========== MODE SOMBRE ==========
function initDarkMode() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.body.classList.add('dark-mode');
        const toggleBtn = document.getElementById('darkModeToggle');
        if (toggleBtn) toggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
}

function toggleDarkMode() {
    const toggleBtn = document.getElementById('darkModeToggle');
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

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', function() {
    const searchTicket = document.getElementById('searchTicket');
    const filterZone = document.getElementById('filterZone');
    const filterStatus = document.getElementById('filterStatus');
    if (searchTicket) searchTicket.addEventListener('input', loadAllTickets);
    if (filterZone) filterZone.addEventListener('change', loadAllTickets);
    if (filterStatus) filterStatus.addEventListener('change', loadAllTickets);
    
    const filterTransaction = document.getElementById('filterTransaction');
    const filterTransactionType = document.getElementById('filterTransactionType');
    if (filterTransaction) filterTransaction.addEventListener('input', loadTransactions);
    if (filterTransactionType) filterTransactionType.addEventListener('change', loadTransactions);
    
    const filterPettyCash = document.getElementById('filterPettyCash');
    const filterPettyCashType = document.getElementById('filterPettyCashType');
    if (filterPettyCash) filterPettyCash.addEventListener('input', loadPettyCashTransactions);
    if (filterPettyCashType) filterPettyCashType.addEventListener('change', loadPettyCashTransactions);
    
    const zoneSelect = document.getElementById('filterZone');
    if (zoneSelect) {
        const zones = ['tabarre', 'delmas', 'petion-ville', 'bois-moquette', 'dezermith', 'fermathe', 'clercine', 'carrefour', 'gerald', 'fort-dimanche'];
        zones.forEach(zone => {
            const option = document.createElement('option');
            option.value = zone;
            option.textContent = zone.charAt(0).toUpperCase() + zone.slice(1);
            zoneSelect.appendChild(option);
        });
    }
    
    initDarkMode();
    const toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleDarkMode);
    
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    function handleEnter(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            adminLogin();
        }
    }
    if (usernameInput) usernameInput.addEventListener('keypress', handleEnter);
    if (passwordInput) passwordInput.addEventListener('keypress', handleEnter);
    
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .commission-value {
            color: #28a745;
            font-weight: bold;
        }
        .error {
            color: #dc3545;
        }
        .toast {
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            font-weight: bold;
        }
        .block-device-btn, .unblock-device-btn {
            padding: 4px 10px;
            border-radius: 5px;
            cursor: pointer;
            border: none;
            color: white;
            font-size: 12px;
        }
        .block-device-btn {
            background-color: #dc3545;
        }
        .unblock-device-btn {
            background-color: #28a745;
        }
    `;
    document.head.appendChild(style);
});

window.addEventListener('resize', function() {
    const menuToggle = document.querySelector('.menu-toggle');
    if (window.innerWidth <= 768) {
        if (menuToggle) menuToggle.style.display = 'block';
    } else {
        if (menuToggle) menuToggle.style.display = 'none';
        closeSidebar();
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('open');
    }
});