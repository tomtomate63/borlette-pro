// URL de l'API
const API_BASE_URL = window.location.origin;

let currentAdmin = null;

async function adminLogin() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success && data.user.isAdmin) {
            currentAdmin = data.user;
            document.getElementById('adminInfo').innerHTML = `<i class="fas fa-user-shield"></i> ${currentAdmin.name}`;
            document.getElementById('loginPage').style.display = 'none';
            document.getElementById('adminPage').style.display = 'flex';
            loadAllData();
        } else {
            document.getElementById('loginError').textContent = 'Accès non autorisé';
            document.getElementById('loginError').style.display = 'block';
        }
    } catch (error) {
        document.getElementById('loginError').textContent = 'Erreur de connexion';
        document.getElementById('loginError').style.display = 'block';
    }
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
        if (clickedBtn) {
            clickedBtn.classList.add('active');
        }
    } else {
        const activeBtn = Array.from(document.querySelectorAll('.nav-btn')).find(btn => 
            btn.textContent.toLowerCase().includes(section.toLowerCase())
        );
        if (activeBtn) activeBtn.classList.add('active');
    }
    
    const titles = {
        dashboard: 'Tableau de bord',
        enregistrement: '📋 ENREGISTREMENT - Nouveaux utilisateurs et points',
        utilisateurs: 'Gestion des utilisateurs',
        pointsVente: 'Points de vente',
        limitesBoules: 'Limites de boules',
        rapports: '📊 RAPPORTS',
        transactions: 'Transactions',
        tickets: 'Tickets',
        controlePaiement: 'Contrôle paiement',
        commissions: 'Commissions',
        tirages: 'Gestion des tirages'
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
}

async function loadDashboard() {
    try {
        const statsRes = await fetch(`${API_BASE_URL}/api/stats`);
        const statsData = await statsRes.json();
        
        if (statsData.success) {
            document.getElementById('totalSales').textContent = statsData.stats.totalSales.toLocaleString() + ' GDS';
            document.getElementById('totalWins').textContent = statsData.stats.totalWins.toLocaleString() + ' GDS';
            document.getElementById('totalCommission').textContent = statsData.stats.totalCommission.toLocaleString() + ' GDS';
            document.getElementById('netProfit').textContent = statsData.stats.netProfit.toLocaleString() + ' GDS';
        }
        
        const zoneRes = await fetch(`${API_BASE_URL}/api/reports/by-zone`);
        const zoneData = await zoneRes.json();
        
        if (zoneData.success) {
            let zoneHtml = '<div class="table-responsive"><table class="data-table"><thead>汽<th>Zone</th><th>Ventes</th><th>Gains</th><th>Commissions</th><th>Bénéfice</th> </thead><tbody>';
            for (const [zone, data] of Object.entries(zoneData.report)) {
                zoneHtml += `<tr><td><strong>${zone}</strong></td><td>${data.totalSales.toLocaleString()} GDS</td><td>${data.totalWins.toLocaleString()} GDS</td><td>${data.totalCommission.toLocaleString()} GDS</td><td>${data.netProfit.toLocaleString()} GDS</td></tr>`;
            }
            zoneHtml += '</tbody></table></div>';
            document.getElementById('zoneStats').innerHTML = zoneHtml;
        }
        
        const ticketsRes = await fetch(`${API_BASE_URL}/api/all-tickets`);
        const ticketsData = await ticketsRes.json();
        
        if (ticketsData.success) {
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
            `).join('') || '<p>Aucune vente</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadUsers() {
    try {
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        
        if (agentsData.success) {
            document.getElementById('agentsList').innerHTML = `
                <div class="table-responsive">
                    <table>
                        <thead>
                            <tr><th>ID</th><th>Agent</th><th>Zone</th><th>Ventes</th><th>Gains</th><th>Commission (5%)</th><th>Solde</th><th>Statut</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            ${agentsData.agents.map(a => {
                                const totalSales = a.total_sales || a.totalSales || 0;
                                const totalWins = a.totalWins || 0;
                                const commission = totalSales * 0.05;
                                const balance = a.balance || 0;
                                return `
                                    <tr>
                                        <td>${a.id}</td>
                                        <td><strong>${a.agent_name || a.agentName || a.name}</strong><br><small>${a.username}</small></td>
                                        <td>${a.zone}</td>
                                        <td>${totalSales.toLocaleString()} GDS</td>
                                        <td>${totalWins.toLocaleString()} GDS</td>
                                        <td class="commission-value">${commission.toLocaleString()} GDS</td>
                                        <td>${balance.toLocaleString()} GDS</td>
                                        <td><span class="${a.is_blocked ? 'agent-blocked' : 'agent-active'}">${a.is_blocked ? 'Bloqué' : 'Actif'}</span></td>
                                        <td><button class="${a.is_blocked ? 'unblock-btn' : 'block-btn'}" onclick="toggleAgentBlock(${a.id}, ${!a.is_blocked})">${a.is_blocked ? 'Débloquer' : 'Bloquer'}</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        const supervisorsRes = await fetch(`${API_BASE_URL}/api/supervisors`);
        const supervisorsData = await supervisorsRes.json();
        
        if (supervisorsData.success) {
            document.getElementById('supervisorsList').innerHTML = `
                <div class="table-responsive">
                    <table>
                        <thead><tr><th>ID</th><th>Superviseur</th><th>Zone</th><th>Statut</th></tr></thead>
                        <tbody>
                            ${supervisorsData.supervisors.map(s => `
                                <tr><td>${s.id}</td><td><strong>${s.prenom} ${s.nom}</strong><br><small>${s.username}</small></td><td>${s.zone}</td><td><span class="${s.isActive ? 'agent-active' : 'agent-blocked'}">${s.isActive ? 'Actif' : 'Inactif'}</span></td></tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadPaymentPoints() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/payment-points`);
        const data = await response.json();
        
        if (data.success) {
            const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
            const agentsData = await agentsRes.json();
            
            const salesByZone = {};
            if (agentsData.success) {
                agentsData.agents.forEach(agent => {
                    const zone = agent.zone;
                    const totalSales = agent.total_sales || agent.totalSales || 0;
                    if (!salesByZone[zone]) salesByZone[zone] = 0;
                    salesByZone[zone] += totalSales;
                });
            }
            
            document.getElementById('paymentPointsList').innerHTML = `
                <div class="table-responsive">
                    <table>
                        <thead><tr><th>ID</th><th>Nom</th><th>Adresse</th><th>Département</th><th>Zone</th><th>Solde</th><th>Statut</th><th>Action</th></tr></thead>
                        <tbody>
                            ${data.paymentPoints.map(p => {
                                const zoneSales = salesByZone[p.zone] || 0;
                                const balance = p.balance || zoneSales;
                                return `
                                    <tr>
                                        <td>${p.id}</td>
                                        <td><strong>${p.nom}</strong></td>
                                        <td>${p.adresse || '-'}</td>
                                        <td>${p.departement || '-'}</td>
                                        <td>${p.zone}</td>
                                        <td>${balance.toLocaleString()} GDS</td>
                                        <td><span class="${p.isActive ? 'agent-active' : 'agent-blocked'}">${p.isActive ? 'Actif' : 'Inactif'}</span></td>
                                        <td><button class="${p.isActive ? 'block-btn' : 'unblock-btn'}" onclick="togglePaymentPoint(${p.id}, ${!p.isActive})">${p.isActive ? 'Désactiver' : 'Activer'}</button></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            
            const activePoints = data.paymentPoints.filter(p => p.isActive);
            const selects = ['depositPointId', 'transferFrom', 'transferTo', 'payPaymentPoint'];
            selects.forEach(id => {
                const select = document.getElementById(id);
                if (select) select.innerHTML = activePoints.map(p => `<option value="${p.id}">${p.nom}</option>`).join('');
            });
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadLimits() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/number-limits`);
        const data = await response.json();
        
        if (data.success) {
            const limits = data.limits;
            document.getElementById('limitsSettings').innerHTML = `
                <div class="limit-card"><h4>Lottery 2 chiffres (00-99)</h4>
                <label><input type="checkbox" id="simpleEnabled" ${limits.simple.enabled ? 'checked' : ''}> Activer les limites</label>
                <textarea id="simpleBlocked" rows="3">${limits.simple.blockedNumbers.join(', ')}</textarea>
                <button onclick="updateLimit('simple', document.getElementById('simpleEnabled').checked, document.getElementById('simpleBlocked').value)">Sauvegarder</button></div>
                <div class="limit-card"><h4>Lottery 3 chiffres (000-999)</h4>
                <label><input type="checkbox" id="threeEnabled" ${limits.three.enabled ? 'checked' : ''}> Activer les limites</label>
                <textarea id="threeBlocked" rows="3">${limits.three.blockedNumbers.join(', ')}</textarea>
                <button onclick="updateLimit('three', document.getElementById('threeEnabled').checked, document.getElementById('threeBlocked').value)">Sauvegarder</button></div>
                <div class="limit-card"><h4>Lottery 5 chiffres (00000-99999)</h4>
                <label><input type="checkbox" id="fiveEnabled" ${limits.five.enabled ? 'checked' : ''}> Activer les limites</label>
                <textarea id="fiveBlocked" rows="3">${limits.five.blockedNumbers.join(', ')}</textarea>
                <button onclick="updateLimit('five', document.getElementById('fiveEnabled').checked, document.getElementById('fiveBlocked').value)">Sauvegarder</button></div>
            `;
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function updateLimit(type, enabled, blockedStr) {
    const blockedNumbers = blockedStr.split(',').map(s => s.trim()).filter(s => s);
    try {
        await fetch(`${API_BASE_URL}/api/update-number-limits`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, enabled, blockedNumbers })
        });
        alert('Limites mises à jour');
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors de la mise à jour');
    }
}

async function loadReports() {
    try {
        const zoneRes = await fetch(`${API_BASE_URL}/api/reports/by-zone`);
        const zoneData = await zoneRes.json();
        if (zoneData.success) {
            let zoneHtml = '<div class="table-responsive"><table><thead><tr><th>Zone</th><th>Ventes</th><th>Gains</th><th>Commissions</th><th>Bénéfice</th><th>Agents</th></tr></thead><tbody>';
            for (const [zone, data] of Object.entries(zoneData.report)) {
                zoneHtml += `<tr><td><strong>${zone}</strong></td><td>${data.totalSales.toLocaleString()} GDS</td><td>${data.totalWins.toLocaleString()} GDS</td><td>${data.totalCommission.toLocaleString()} GDS</td><td>${data.netProfit.toLocaleString()} GDS</td><td>${data.agentsCount}</td></tr>`;
            }
            zoneHtml += '</tbody></table></div>';
            document.getElementById('reportsByZone').innerHTML = zoneHtml;
        }
        
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        if (agentsData.success) {
            let agentHtml = '<div class="table-responsive"><table><thead><tr><th>Agent</th><th>Zone</th><th>Ventes</th><th>Gains</th><th>Commission</th><th>Solde</th></tr></thead><tbody>';
            agentsData.agents.forEach(a => {
                agentHtml += `<tr><td><strong>${a.agentName || a.name}</strong><br><small>${a.username}</small></td><td>${a.zone}</td><td>${(a.totalSales || 0).toLocaleString()} GDS</td><td>${(a.totalWins || 0).toLocaleString()} GDS</td><td>${(a.commission || 0).toLocaleString()} GDS</td><td>${(a.balance || 0).toLocaleString()} GDS</td></tr>`;
            });
            agentHtml += '</tbody></table></div>';
            document.getElementById('reportsByAgent').innerHTML = agentHtml;
        }
        
        document.getElementById('reportsByDept').innerHTML = '<p>Rapports par département à venir</p>';
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/transactions`);
        const data = await response.json();
        
        if (data.success) {
            let transactions = data.transactions;
            const search = document.getElementById('filterTransaction')?.value.toLowerCase();
            const type = document.getElementById('filterTransactionType')?.value;
            
            if (search) transactions = transactions.filter(t => t.description?.toLowerCase().includes(search));
            if (type) transactions = transactions.filter(t => t.type === type);
            
            document.getElementById('transactionsList').innerHTML = transactions.map(t => `
                <div class="transaction-item ${t.type}">
                    <div class="transaction-header">
                        <span class="transaction-type">${getTransactionTypeIcon(t.type)} ${t.type.toUpperCase()}</span>
                        <span class="transaction-date">${new Date(t.date).toLocaleString()}</span>
                    </div>
                    <div class="transaction-details">
                        ${t.description || `${t.type} de ${t.amount} GDS`}
                        ${t.amount ? `<br><strong>Montant: ${t.amount.toLocaleString()} GDS</strong>` : ''}
                        ${t.previousBalance !== undefined ? `<br>Balance antérieure: ${t.previousBalance.toLocaleString()} GDS` : ''}
                        ${t.newBalance !== undefined ? `<br>Balance actuelle: ${t.newBalance.toLocaleString()} GDS` : ''}
                    </div>
                </div>
            `).join('') || '<p>Aucune transaction</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

function getTransactionTypeIcon(type) {
    const icons = { vente: '💰', dechargement: '💵', transfert: '🔄', gain: '🏆', annulation: '❌' };
    return icons[type] || '📋';
}

async function loadAllTickets() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/all-tickets`);
        const data = await response.json();
        
        if (data.success) {
            let tickets = data.tickets;
            const search = document.getElementById('searchTicket')?.value.toLowerCase();
            const zone = document.getElementById('filterZone')?.value;
            const status = document.getElementById('filterStatus')?.value;
            
            if (search) tickets = tickets.filter(t => t.id.toLowerCase().includes(search));
            if (zone) tickets = tickets.filter(t => t.zone === zone);
            if (status === 'winner') tickets = tickets.filter(t => t.isWinner);
            else if (status === 'cancelled') tickets = tickets.filter(t => t.isCancelled);
            else if (status === 'active') tickets = tickets.filter(t => !t.isCancelled && !t.isWinner);
            
            document.getElementById('allTicketsList').innerHTML = tickets.map(t => {
                let statusBadge = '';
                if (t.isCancelled) statusBadge = '<span class="cancelled-badge">Annulé</span>';
                else if (t.isWinner) statusBadge = `<span class="winner-badge">Gagnant ${t.winAmount} GDS ${!t.isPaid ? '⚠️ Non payé' : '✅ Payé'}</span>`;
                else statusBadge = '<span class="pending-badge">En attente</span>';
                
                const itemsHtml = t.items ? t.items.map(i => `<div>${i.number} : ${i.amount} GDS</div>`).join('') : `<div>${t.number} : ${t.amount} GDS</div>`;
                
                return `
                    <div class="ticket-item ${t.isCancelled ? 'cancelled' : (t.isWinner ? 'winner' : '')}">
                        <strong>${t.id}</strong><br>
                        ${itemsHtml}
                        <strong>Total: ${t.totalAmount || t.amount} GDS</strong><br>
                        Agent: ${t.agentName} | Zone: ${t.zone}<br>
                        Tirage: ${t.drawingName}<br>
                        Date: ${new Date(t.date).toLocaleString()}
                        ${statusBadge}
                        ${t.isCancelled ? `<br><small>Annulé: ${t.cancelReason} (${new Date(t.cancelledAt).toLocaleString()})</small>` : ''}
                        ${t.isWinner && !t.isPaid ? `<br><button class="pay-btn" onclick="payTicket('${t.id}')">💰 Payer ce ticket</button>` : ''}
                    </div>
                `;
            }).join('') || '<p>Aucun ticket</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadPaymentControl() {
    try {
        const pointsRes = await fetch(`${API_BASE_URL}/api/payment-points`);
        const pointsData = await pointsRes.json();
        
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        
        const salesByZone = {};
        if (agentsData.success) {
            agentsData.agents.forEach(agent => {
                const zone = agent.zone;
                const totalSales = agent.total_sales || agent.totalSales || 0;
                if (!salesByZone[zone]) salesByZone[zone] = 0;
                salesByZone[zone] += totalSales;
            });
        }
        
        if (pointsData.success) {
            let html = '<div class="table-responsive"><table><thead><tr><th>Point de paiement</th><th>Solde actuel</th><th>Ventes de la zone</th></tr></thead><tbody>';
            pointsData.paymentPoints.forEach(p => {
                const zoneSales = salesByZone[p.zone] || 0;
                html += `<tr><td><strong>${p.nom}</strong></td><td>${p.balance.toLocaleString()} GDS</td><td>${zoneSales.toLocaleString()} GDS</td></tr>`;
            });
            html += '</tbody></table></div>';
            document.getElementById('paymentControl').innerHTML = html;
        }
        
        await loadPaymentPoints();
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadCommissions() {
    try {
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        
        if (agentsData.success) {
            let html = '<div class="table-responsive"><table><thead><tr><th>Agent</th><th>Zone</th><th>Commission (5%)</th><th>Total ventes</th></tr></thead><tbody>';
            agentsData.agents.forEach(a => {
                const totalSales = a.total_sales || a.totalSales || 0;
                const commission = totalSales * 0.05;
                html += `<tr><td><strong>${a.agent_name || a.agentName || a.name}</strong><br><small>${a.username}</small></td><td>${a.zone}</td><td class="commission-value">${commission.toLocaleString()} GDS</td><td>${totalSales.toLocaleString()} GDS</td></tr>`;
            });
            html += '</tbody></table></div>';
            document.getElementById('agentCommissions').innerHTML = html;
        }
        
        const pointsRes = await fetch(`${API_BASE_URL}/api/payment-points`);
        const pointsData = await pointsRes.json();
        
        if (pointsData.success) {
            const agentsRes2 = await fetch(`${API_BASE_URL}/api/agents`);
            const agentsData2 = await agentsRes2.json();
            const commissionByZone = {};
            if (agentsData2.success) {
                agentsData2.agents.forEach(a => {
                    const zone = a.zone;
                    const totalSales = a.total_sales || a.totalSales || 0;
                    const commission = totalSales * 0.05;
                    if (!commissionByZone[zone]) commissionByZone[zone] = 0;
                    commissionByZone[zone] += commission;
                });
            }
            
            let html = '<div class="table-responsive"><table><thead><tr><th>Point de paiement</th><th>Zone</th><th>Commission totale</th></tr></thead><tbody>';
            pointsData.paymentPoints.forEach(p => {
                const zoneCommission = commissionByZone[p.zone] || 0;
                html += `<tr><td><strong>${p.nom}</strong></td><td>${p.zone}</td><td>${zoneCommission.toLocaleString()} GDS</td></tr>`;
            });
            html += '</tbody></table></div>';
            document.getElementById('paymentPointCommissions').innerHTML = html;
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function loadDrawingsHistory() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/drawings`);
        const data = await response.json();
        
        if (data.success && data.drawings) {
            document.getElementById('drawingsHistory').innerHTML = data.drawings.map(d => `
                <div class="history-item">
                    <strong>${d.drawingName}</strong><br>
                    Numéro: ${d.drawingNumber}<br>
                    Date: ${new Date(d.date).toLocaleString()}
                </div>
            `).join('') || '<p>Aucun tirage</p>';
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function createAgent() {
    const agentData = {
        username: document.getElementById('newUsername').value,
        password: document.getElementById('newPassword').value || '1234',
        prenom: document.getElementById('newPrenom').value,
        nom: document.getElementById('newNom').value,
        agentName: document.getElementById('newAgentName').value || `${document.getElementById('newPrenom').value} ${document.getElementById('newNom').value}`,
        zone: document.getElementById('newZone').value,
        dateNaissance: document.getElementById('newDateNaissance').value,
        carteIdentite: document.getElementById('newCarteIdentite').value,
        matriculeFiscale: document.getElementById('newMatriculeFiscale').value,
        permis: document.getElementById('newPermis').value
    };
    
    if (!agentData.username || !agentData.prenom || !agentData.nom) {
        alert('Remplissez les champs obligatoires');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentData)
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('createAgentResult');
        if (data.success) {
            resultDiv.innerHTML = '<p style="color:green;">✅ Vendeur créé avec succès !</p>';
            document.getElementById('newUsername').value = '';
            document.getElementById('newPassword').value = '1234';
            document.getElementById('newPrenom').value = '';
            document.getElementById('newNom').value = '';
            document.getElementById('newAgentName').value = '';
            document.getElementById('newDateNaissance').value = '';
            document.getElementById('newCarteIdentite').value = '';
            document.getElementById('newMatriculeFiscale').value = '';
            document.getElementById('newPermis').value = '';
            loadUsers();
        } else {
            resultDiv.innerHTML = '<p style="color:red;">❌ Erreur lors de la création</p>';
        }
        
        setTimeout(() => resultDiv.innerHTML = '', 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function createSupervisor() {
    const supervisorData = {
        username: document.getElementById('superUsername').value,
        password: document.getElementById('superPassword').value,
        prenom: document.getElementById('superPrenom').value,
        nom: document.getElementById('superNom').value,
        zone: document.getElementById('superZone').value,
        carteIdentite: document.getElementById('superCarteIdentite').value,
        matriculeFiscale: document.getElementById('superMatriculeFiscale').value,
        dateNaissance: document.getElementById('superDateNaissance').value
    };
    
    if (!supervisorData.username || !supervisorData.prenom || !supervisorData.nom) {
        alert('Remplissez les champs obligatoires');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-supervisor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(supervisorData)
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('createSupervisorResult');
        if (data.success) {
            resultDiv.innerHTML = '<p style="color:green;">✅ Superviseur créé avec succès !</p>';
            document.getElementById('superUsername').value = '';
            document.getElementById('superPassword').value = 'super123';
            document.getElementById('superPrenom').value = '';
            document.getElementById('superNom').value = '';
            document.getElementById('superCarteIdentite').value = '';
            document.getElementById('superMatriculeFiscale').value = '';
            document.getElementById('superDateNaissance').value = '';
            loadUsers();
        } else {
            resultDiv.innerHTML = '<p style="color:red;">❌ Erreur lors de la création</p>';
        }
        
        setTimeout(() => resultDiv.innerHTML = '', 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function createPaymentPoint() {
    const pointData = {
        nom: document.getElementById('pointNom').value,
        adresse: document.getElementById('pointAdresse').value,
        departement: document.getElementById('pointDepartement').value,
        zone: document.getElementById('pointZone').value,
        balance: parseInt(document.getElementById('pointBalance').value) || 0
    };
    
    if (!pointData.nom) {
        alert('Entrez le nom du point de paiement');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/create-payment-point`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pointData)
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('createPointResult');
        if (data.success) {
            resultDiv.innerHTML = '<p style="color:green;">✅ Point de paiement créé avec succès !</p>';
            document.getElementById('pointNom').value = '';
            document.getElementById('pointAdresse').value = '';
            document.getElementById('pointDepartement').value = '';
            document.getElementById('pointZone').value = '';
            document.getElementById('pointBalance').value = '0';
            loadPaymentPoints();
        } else {
            resultDiv.innerHTML = '<p style="color:red;">❌ Erreur lors de la création</p>';
        }
        
        setTimeout(() => resultDiv.innerHTML = '', 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function toggleAgentBlock(agentId, block) {
    try {
        await fetch(`${API_BASE_URL}/api/toggle-agent-block`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, block })
        });
        loadUsers();
    } catch (error) {
        console.error('Erreur:', error);
        alert('Erreur lors du blocage/déblocage');
    }
}

async function toggleAgentBlockById() {
    const identifier = document.getElementById('blockAgentId').value;
    const action = document.getElementById('blockAction').value;
    const block = action === 'block';
    
    if (!identifier) {
        alert('Entrez l\'identifiant de l\'agent');
        return;
    }
    
    try {
        const agentsRes = await fetch(`${API_BASE_URL}/api/agents`);
        const agentsData = await agentsRes.json();
        const agent = agentsData.agents.find(a => a.id == identifier || a.username === identifier);
        
        if (!agent) {
            alert('Agent non trouvé');
            return;
        }
        
        await toggleAgentBlock(agent.id, block);
        document.getElementById('blockResult').innerHTML = `<p style="color:green;">✅ Agent ${agent.username} ${block ? 'bloqué' : 'débloqué'}</p>`;
        setTimeout(() => document.getElementById('blockResult').innerHTML = '', 3000);
        document.getElementById('blockAgentId').value = '';
    } catch (error) {
        alert('Erreur');
    }
}

async function togglePaymentPoint(pointId, isActive) {
    try {
        await fetch(`${API_BASE_URL}/api/update-payment-point`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: pointId, isActive })
        });
        loadPaymentPoints();
    } catch (error) {
        console.error('Erreur:', error);
    }
}

async function makeDeposit() {
    const agentId = parseInt(document.getElementById('depositAgentId').value);
    const paymentPointId = parseInt(document.getElementById('depositPointId').value);
    const amount = parseInt(document.getElementById('depositAmount').value);
    const notes = document.getElementById('depositNotes').value;
    
    if (!agentId || !paymentPointId || !amount) {
        alert('Remplissez tous les champs');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ agentId, amount, paymentPointId, notes })
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('depositResult');
        if (data.success) {
            resultDiv.innerHTML = `<p style="color:green;">✅ Déchargement effectué ! Nouveau solde: ${data.newBalance.toLocaleString()} GDS</p>`;
            document.getElementById('depositAgentId').value = '';
            document.getElementById('depositAmount').value = '';
            document.getElementById('depositNotes').value = '';
            loadUsers();
            loadPaymentPoints();
            loadTransactions();
        } else {
            resultDiv.innerHTML = `<p style="color:red;">❌ ${data.message}</p>`;
        }
        
        setTimeout(() => resultDiv.innerHTML = '', 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function makeTransfer() {
    const fromPointId = parseInt(document.getElementById('transferFrom').value);
    const toPointId = parseInt(document.getElementById('transferTo').value);
    const amount = parseInt(document.getElementById('transferAmount').value);
    const notes = document.getElementById('transferNotes').value;
    
    if (!fromPointId || !toPointId || !amount) {
        alert('Remplissez tous les champs');
        return;
    }
    
    if (fromPointId === toPointId) {
        alert('Impossible de transférer vers le même point');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fromPointId, toPointId, amount, notes })
        });
        
        const data = await response.json();
        
        const resultDiv = document.getElementById('transferResult');
        if (data.success) {
            resultDiv.innerHTML = '<p style="color:green;">✅ Transfert effectué avec succès !</p>';
            document.getElementById('transferAmount').value = '';
            document.getElementById('transferNotes').value = '';
            loadPaymentPoints();
            loadTransactions();
        } else {
            resultDiv.innerHTML = `<p style="color:red;">❌ ${data.message}</p>`;
        }
        
        setTimeout(() => resultDiv.innerHTML = '', 3000);
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function saveDrawing() {
    const drawingName = document.getElementById('drawingSelect').value;
    const drawingNumber = document.getElementById('drawingNumber').value;
    
    if (!drawingNumber) {
        alert('Entrez le numéro gagnant');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/save-drawing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ drawingName, drawingNumber })
        });
        
        if (response.ok) {
            document.getElementById('drawingMessage').innerHTML = '<p style="color:green;">✅ Tirage enregistré !</p>';
            document.getElementById('drawingNumber').value = '';
            loadDrawingsHistory();
            loadDashboard();
            loadAllTickets();
            setTimeout(() => document.getElementById('drawingMessage').innerHTML = '', 3000);
        } else {
            alert('Erreur');
        }
    } catch (error) {
        alert('Erreur de connexion');
    }
}

async function payTicket(ticketId) {
    const paymentPointId = prompt('Entrez l\'ID du point de paiement pour ce paiement:');
    if (!paymentPointId) return;
    try {
        alert(`Ticket ${ticketId} marqué comme payé au point ${paymentPointId}`);
        loadAllTickets();
    } catch (error) {
        alert('Erreur');
    }
}

async function markTicketAsPaid() {
    const ticketId = document.getElementById('payTicketId').value;
    const paymentPointId = document.getElementById('payPaymentPoint').value;
    
    if (!ticketId) {
        alert('Entrez le numéro du ticket');
        return;
    }
    
    alert(`Ticket ${ticketId} payé au point ${paymentPointId}`);
    document.getElementById('payTicketId').value = '';
    loadAllTickets();
}

function adminLogout() {
    currentAdmin = null;
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminPage').style.display = 'none';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// ========== FONCTIONS POUR MENU MOBILE ==========
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

// ========== EXPORT PDF ==========
async function exportToPDF(title, data, columns) {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert('jsPDF non chargé. Veuillez rafraîchir la page.');
        return;
    }
    const { jsPDF } = window.jspdf;
    const { autoTable } = window.jspdf;
    
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(30, 60, 114);
    doc.text(title, 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleString('fr-FR');
    doc.text(`Généré le : ${dateStr}`, 14, 28);
    
    autoTable(doc, {
        head: [columns],
        body: data,
        startY: 35,
        theme: 'striped',
        headStyles: { fillColor: [30, 60, 114], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 3 },
        margin: { left: 14, right: 14 }
    });
    
    doc.save(`${title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', function() {
    // Filtres
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
    
    const menuToggle = document.querySelector('.menu-toggle');
    if (window.innerWidth <= 768 && menuToggle) menuToggle.style.display = 'block';
    
    // Bouton export PDF
    const exportZoneBtn = document.getElementById('exportZoneStatsBtn');
    if (exportZoneBtn) {
        exportZoneBtn.addEventListener('click', async function() {
            const zoneStatsDiv = document.getElementById('zoneStats');
            const table = zoneStatsDiv.querySelector('table');
            if (table) {
                const rows = table.querySelectorAll('tr');
                const headers = Array.from(rows[0].querySelectorAll('th')).map(th => th.innerText);
                const data = Array.from(rows).slice(1).map(row => 
                    Array.from(row.querySelectorAll('td')).map(cell => cell.innerText)
                );
                await exportToPDF('Ventes_par_zone', data, headers);
            } else {
                alert('Aucune donnée à exporter');
            }
        });
    }
    
    // Mode sombre
    initDarkMode();
    const toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleDarkMode);
    
    // Touche Entrée
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

// ========== SERVICE WORKER PWA ==========
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(registration => console.log('Service Worker enregistré avec succès'))
        .catch(error => console.log('Erreur Service Worker:', error));
}