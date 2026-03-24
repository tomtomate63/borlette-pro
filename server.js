// backend/server.js - Version Supabase
const http = require('http');
const fs = require('fs');
const path = require('path');
const supabase = require('./supabase-client');

// Fonction pour servir les fichiers statiques
function serveStaticFile(filePath, res, contentType = 'text/html') {
    try {
        if (!fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end('Fichier non trouvé');
            return false;
        }
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return true;
    } catch (err) {
        res.writeHead(500);
        res.end('Erreur serveur');
        return false;
    }
}

function generateTicketId(prefix = 'TKT') {
    const date = new Date();
    return `${prefix}-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}-${Math.floor(Math.random()*10000).toString().padStart(4,'0')}`;
}

function getTicketType(number) {
    if (number.length === 2) return 'simple';
    if (number.length === 3) return 'three';
    if (number.length === 5) return 'five';
    return 'simple';
}

function getWinningCombinations(drawingNumber) {
    const str = drawingNumber.toString();
    const combos = { 
        threeDigit: str.substring(0, 3), 
        firstPrize: str.substring(3, 5), 
        secondPrize: str.substring(5, 7), 
        thirdPrize: str.substring(7, 9), 
        fiveDigitCombos: [] 
    };
    if (str.length >= 5) combos.fiveDigitCombos = [str.substring(0, 5), str.substring(1, 6), str.substring(0, 3) + str.substring(5, 7)];
    return combos;
}

function calculateWin(item, drawingResult) {
    const combos = getWinningCombinations(drawingResult);
    if (item.number === combos.threeDigit) return { winAmount: item.amount * 60, winType: "Lotto 3 chiffres" };
    if (combos.fiveDigitCombos.includes(item.number)) return { winAmount: item.amount * 60, winType: "Lotto 5 chiffres" };
    if (item.number === combos.firstPrize) return { winAmount: item.amount * 60, winType: "Premier lot" };
    if (item.number === combos.secondPrize) return { winAmount: item.amount * 20, winType: "Deuxième lot" };
    if (combos.thirdPrize && item.number === combos.thirdPrize) return { winAmount: item.amount * 10, winType: "Troisième lot" };
    return { winAmount: 0, winType: null };
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') { 
        res.writeHead(200); 
        res.end(); 
        return; 
    }
    
    const url = req.url;
    
    // Servir les fichiers statiques
    if (url.startsWith('/agent-app/')) {
        let filePath = path.join(__dirname, '..', 'agent-app', url.replace('/agent-app/', ''));
        if (filePath.endsWith('/') || !path.extname(filePath)) {
            filePath = path.join(filePath, 'index.html');
        }
        const ext = path.extname(filePath);
        let contentType = 'text/html';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.js') contentType = 'application/javascript';
        serveStaticFile(filePath, res, contentType);
        return;
    }
    
    if (url.startsWith('/admin-app/')) {
        let filePath = path.join(__dirname, '..', 'admin-app', url.replace('/admin-app/', ''));
        if (filePath.endsWith('/') || !path.extname(filePath)) {
            filePath = path.join(filePath, 'index.html');
        }
        const ext = path.extname(filePath);
        let contentType = 'text/html';
        if (ext === '.css') contentType = 'text/css';
        if (ext === '.js') contentType = 'application/javascript';
        serveStaticFile(filePath, res, contentType);
        return;
    }
    
    if (url === '/') {
        res.writeHead(302, { 'Location': '/agent-app/index.html' });
        res.end();
        return;
    }
    
    // Helper pour parser le body
    const parseBody = () => {
        return new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch (e) {
                    resolve({});
                }
            });
            req.on('error', reject);
        });
    };
    
    // ==================== API ROUTES ====================
    
    // Test API
    if (url === '/api/test' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Serveur OK avec Supabase', timestamp: new Date().toISOString() }));
        return;
    }
    
    // LOGIN
    if (url === '/api/login' && req.method === 'POST') {
        const body = await parseBody();
        const { username, password } = body;
        
        // Chercher dans agents
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('*')
            .eq('username', username)
            .eq('password', password);
        
        let user = agents && agents.length > 0 ? agents[0] : null;
        let isSupervisor = false;
        
        if (!user) {
            // Chercher dans superviseurs
            let { data: supervisors, error: supError } = await supabase
                .from('supervisors')
                .select('*')
                .eq('username', username)
                .eq('password', password);
            
            if (supervisors && supervisors.length > 0) {
                user = supervisors[0];
                isSupervisor = true;
            }
        }
        
        if (user) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    name: user.agent_name || `${user.prenom || ''} ${user.nom || ''}`.trim() || user.name,
                    agentName: user.agent_name,
                    zone: user.zone,
                    isAdmin: user.is_admin || false,
                    isSupervisor: isSupervisor,
                    isBlocked: user.is_blocked || false,
                    totalSales: user.total_sales || 0,
                    balance: user.balance || 0,
                    commission: user.commission || 0,
                    type: user.type || (isSupervisor ? 'supervisor' : 'vendeur')
                } 
            }));
        } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Identifiants incorrects' }));
        }
        return;
    }
    
    // VENTE DE TICKET
    if (url === '/api/sell-multi-ticket' && req.method === 'POST') {
        const body = await parseBody();
        const { agentId, items, drawingName, notes } = body;
        
        // Vérifier l'agent
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single();
        
        if (!agent || agent.is_blocked) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: agent ? 'POS bloqué' : 'Agent non trouvé' }));
            return;
        }
        
        // Vérifier les limites de boules
        for (const item of items) {
            let { data: limits, error: limitsError } = await supabase
                .from('number_limits')
                .select('*')
                .eq('type', item.ticketType)
                .single();
            
            if (limits && limits.enabled && limits.blocked_numbers && limits.blocked_numbers.includes(item.number)) {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: `Le numéro ${item.number} est bloqué` }));
                return;
            }
        }
        
        const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
        const ticketId = generateTicketId();
        
        const ticketData = {
            id: ticketId,
            agent_id: agentId,
            items: items,
            total_amount: totalAmount,
            drawing_name: drawingName,
            notes: notes,
            date: new Date().toISOString(),
            is_winner: false,
            win_amount: 0,
            win_items: [],
            is_cancelled: false,
            is_paid: false
        };
        
        // Sauvegarder le ticket
        let { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .insert([ticketData])
            .select()
            .single();
        
        if (ticketError) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Erreur sauvegarde ticket' }));
            return;
        }
        
        // Mettre à jour l'agent
        await supabase
            .from('agents')
            .update({
                total_sales: (agent.total_sales || 0) + totalAmount,
                balance: (agent.balance || 0) + totalAmount,
                commission: (agent.commission || 0) + totalAmount * 0.05
            })
            .eq('id', agentId);
        
        // Ajouter transaction
        await supabase
            .from('transactions')
            .insert([{
                type: 'vente',
                agent_id: agentId,
                agent_name: agent.agent_name || `${agent.prenom} ${agent.nom}`,
                zone: agent.zone,
                amount: totalAmount,
                ticket_id: ticketId,
                date: new Date().toISOString(),
                description: `Vente ticket ${ticketId}`
            }]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, ticket: { ...ticket, id: ticketId, totalAmount: totalAmount, items: items, drawingName: drawingName, notes: notes, date: new Date().toISOString() } }));
        return;
    }
    
    // ANNULATION TICKET
    if (url === '/api/cancel-ticket' && req.method === 'PUT') {
        const body = await parseBody();
        const { ticketId, reason } = body;
        
        // Récupérer le ticket
        let { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticketId)
            .single();
        
        if (!ticket || ticket.is_cancelled) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Ticket non trouvé ou déjà annulé' }));
            return;
        }
        
        // Récupérer l'agent
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', ticket.agent_id)
            .single();
        
        if (agent) {
            await supabase
                .from('agents')
                .update({
                    total_sales: (agent.total_sales || 0) - ticket.total_amount,
                    balance: (agent.balance || 0) - ticket.total_amount,
                    commission: (agent.commission || 0) - ticket.total_amount * 0.05
                })
                .eq('id', agent.id);
        }
        
        // Annuler le ticket
        await supabase
            .from('tickets')
            .update({
                is_cancelled: true,
                cancelled_at: new Date().toISOString(),
                cancel_reason: reason || 'Annulation'
            })
            .eq('id', ticketId);
        
        // Ajouter transaction
        await supabase
            .from('transactions')
            .insert([{
                type: 'annulation',
                agent_id: ticket.agent_id,
                agent_name: agent ? agent.agent_name : 'Inconnu',
                zone: agent ? agent.zone : 'Inconnu',
                amount: -ticket.total_amount,
                ticket_id: ticketId,
                date: new Date().toISOString(),
                description: `Annulation ticket ${ticketId} - ${reason}`
            }]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Ticket annulé avec succès' }));
        return;
    }
    
    // TICKETS PAR AGENT
    if (url.startsWith('/api/agent-tickets') && req.method === 'GET') {
        const agentId = parseInt(url.split('=')[1]);
        
        let { data: tickets, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('agent_id', agentId)
            .order('date', { ascending: false });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tickets: tickets || [] }));
        return;
    }
    
    // TOUS LES TICKETS
    if (url === '/api/all-tickets' && req.method === 'GET') {
        let { data: tickets, error } = await supabase
            .from('tickets')
            .select('*')
            .order('date', { ascending: false });
        
        // Ajouter les infos agent
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('id, agent_name, zone');
        
        const agentsMap = {};
        if (agents) {
            agents.forEach(a => {
                agentsMap[a.id] = a;
            });
        }
        
        const ticketsWithAgent = (tickets || []).map(t => ({
            ...t,
            agentName: agentsMap[t.agent_id]?.agent_name || 'Inconnu',
            zone: agentsMap[t.agent_id]?.zone || 'Inconnu'
        }));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tickets: ticketsWithAgent }));
        return;
    }
    
    // STATISTIQUES
    if (url === '/api/stats' && req.method === 'GET') {
        let { data: tickets, error } = await supabase
            .from('tickets')
            .select('total_amount, win_amount, is_cancelled, is_winner');
        
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('commission');
        
        const totalSales = (tickets || []).filter(t => !t.is_cancelled).reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const totalWins = (tickets || []).filter(t => t.is_winner && !t.is_cancelled).reduce((sum, t) => sum + (t.win_amount || 0), 0);
        const totalCommission = (agents || []).reduce((sum, a) => sum + (a.commission || 0), 0);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, stats: { totalSales, totalWins, totalCommission, netProfit: totalSales - totalWins - totalCommission } }));
        return;
    }
    
    // AGENTS
    if (url === '/api/agents' && req.method === 'GET') {
        let { data: agents, error } = await supabase
            .from('agents')
            .select('*')
            .neq('is_admin', true);
        
        // Ajouter totalWins
        let { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('agent_id, win_amount, is_winner, is_cancelled');
        
        const agentsWithWins = (agents || []).map(a => {
            const agentTickets = (tickets || []).filter(t => t.agent_id === a.id && !t.is_cancelled);
            const totalWins = agentTickets.filter(t => t.is_winner).reduce((sum, t) => sum + (t.win_amount || 0), 0);
            return { ...a, totalWins };
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, agents: agentsWithWins }));
        return;
    }
    
    // CRÉER AGENT
    if (url === '/api/create-agent' && req.method === 'POST') {
        const body = await parseBody();
        
        const { data: existing, error: existingError } = await supabase
            .from('agents')
            .select('id')
            .eq('username', body.username);
        
        if (existing && existing.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Nom d\'utilisateur déjà existant' }));
            return;
        }
        
        const newAgent = {
            username: body.username,
            password: body.password || '1234',
            prenom: body.prenom,
            nom: body.nom,
            agent_name: body.agentName || `${body.prenom} ${body.nom}`,
            zone: body.zone,
            is_blocked: false,
            total_sales: 0,
            balance: 0,
            commission: 0,
            commission_rate: 0.05,
            date_naissance: body.dateNaissance,
            carte_identite: body.carteIdentite,
            matricule_fiscale: body.matriculeFiscale,
            permis: body.permis,
            date_inscription: new Date().toISOString(),
            type: 'vendeur'
        };
        
        let { data: agent, error } = await supabase
            .from('agents')
            .insert([newAgent])
            .select()
            .single();
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, agent }));
        return;
    }
    
    // POINTS DE PAIEMENT
    if (url === '/api/payment-points' && req.method === 'GET') {
        let { data: paymentPoints, error } = await supabase
            .from('payment_points')
            .select('*')
            .order('id');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, paymentPoints: paymentPoints || [] }));
        return;
    }
    
    // CRÉER POINT DE PAIEMENT
    if (url === '/api/create-payment-point' && req.method === 'POST') {
        const body = await parseBody();
        
        const newPoint = {
            nom: body.nom,
            adresse: body.adresse,
            departement: body.departement,
            zone: body.zone,
            is_active: true,
            balance: body.balance || 0,
            total_transactions: 0,
            date_creation: new Date().toISOString()
        };
        
        let { data: point, error } = await supabase
            .from('payment_points')
            .insert([newPoint])
            .select()
            .single();
        
        // Ajouter la zone si elle n'existe pas
        let { data: existingZone } = await supabase
            .from('zones')
            .select('name')
            .eq('name', body.zone);
        
        if (!existingZone || existingZone.length === 0) {
            await supabase.from('zones').insert([{ name: body.zone }]);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    // MODIFIER POINT DE PAIEMENT
    if (url === '/api/update-payment-point' && req.method === 'PUT') {
        const body = await parseBody();
        const { id, isActive } = body;
        
        let { error } = await supabase
            .from('payment_points')
            .update({ is_active: isActive })
            .eq('id', id);
        
        if (error) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Point non trouvé' }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        }
        return;
    }
    
    // TRANSACTIONS
    if (url === '/api/transactions' && req.method === 'GET') {
        let { data: transactions, error } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, transactions: transactions || [] }));
        return;
    }
    
    // DÉCHARGEMENT
    if (url === '/api/deposit' && req.method === 'POST') {
        const body = await parseBody();
        const { agentId, amount, paymentPointId, notes } = body;
        
        // Récupérer l'agent
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single();
        
        // Récupérer le point de paiement
        let { data: paymentPoint, error: pointError } = await supabase
            .from('payment_points')
            .select('*')
            .eq('id', paymentPointId)
            .single();
        
        if (!agent || !paymentPoint) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Agent ou point de paiement non trouvé' }));
            return;
        }
        
        if ((agent.balance || 0) < amount) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Solde insuffisant' }));
            return;
        }
        
        const previousBalance = agent.balance || 0;
        const newBalance = previousBalance - amount;
        
        // Mettre à jour l'agent
        await supabase
            .from('agents')
            .update({ balance: newBalance })
            .eq('id', agentId);
        
        // Mettre à jour le point de paiement
        await supabase
            .from('payment_points')
            .update({ balance: (paymentPoint.balance || 0) + amount })
            .eq('id', paymentPointId);
        
        // Ajouter transaction
        await supabase
            .from('transactions')
            .insert([{
                type: 'dechargement',
                agent_id: agentId,
                agent_name: agent.agent_name || `${agent.prenom} ${agent.nom}`,
                zone: agent.zone,
                payment_point_id: paymentPointId,
                payment_point_name: paymentPoint.nom,
                amount: amount,
                previous_balance: previousBalance,
                new_balance: newBalance,
                date: new Date().toISOString(),
                description: `Déchargement de ${amount} GDS par ${agent.agent_name} au ${paymentPoint.nom}`,
                notes: notes
            }]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, newBalance: newBalance }));
        return;
    }
    
    // TRANSFERT ENTRE POINTS
    if (url === '/api/transfer' && req.method === 'POST') {
        const body = await parseBody();
        const { fromPointId, toPointId, amount, notes } = body;
        
        let { data: fromPoint, error: fromError } = await supabase
            .from('payment_points')
            .select('*')
            .eq('id', fromPointId)
            .single();
        
        let { data: toPoint, error: toError } = await supabase
            .from('payment_points')
            .select('*')
            .eq('id', toPointId)
            .single();
        
        if (!fromPoint || !toPoint) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Point de paiement non trouvé' }));
            return;
        }
        
        if ((fromPoint.balance || 0) < amount) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Solde insuffisant' }));
            return;
        }
        
        // Mettre à jour les soldes
        await supabase
            .from('payment_points')
            .update({ balance: (fromPoint.balance || 0) - amount })
            .eq('id', fromPointId);
        
        await supabase
            .from('payment_points')
            .update({ balance: (toPoint.balance || 0) + amount })
            .eq('id', toPointId);
        
        // Ajouter transfert
        await supabase
            .from('transfers')
            .insert([{
                from_point_id: fromPointId,
                from_point_name: fromPoint.nom,
                to_point_id: toPointId,
                to_point_name: toPoint.nom,
                amount: amount,
                date: new Date().toISOString(),
                notes: notes
            }]);
        
        // Ajouter transaction
        await supabase
            .from('transactions')
            .insert([{
                type: 'transfert',
                from_point_id: fromPointId,
                from_point_name: fromPoint.nom,
                to_point_id: toPointId,
                to_point_name: toPoint.nom,
                amount: amount,
                date: new Date().toISOString(),
                description: `Transfert de ${amount} GDS de ${fromPoint.nom} vers ${toPoint.nom}`
            }]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    // RAPPORTS PAR ZONE
    if (url === '/api/reports/by-zone' && req.method === 'GET') {
        let { data: zones, error: zonesError } = await supabase
            .from('zones')
            .select('name');
        
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('id, zone, commission');
        
        let { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('agent_id, total_amount, win_amount, is_winner, is_cancelled');
        
        const report = {};
        
        for (const zone of (zones || [])) {
            const zoneName = zone.name;
            const zoneAgents = (agents || []).filter(a => a.zone === zoneName);
            const agentIds = zoneAgents.map(a => a.id);
            
            const zoneTickets = (tickets || []).filter(t => agentIds.includes(t.agent_id) && !t.is_cancelled);
            
            const totalSales = zoneTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
            const totalWins = zoneTickets.filter(t => t.is_winner).reduce((sum, t) => sum + (t.win_amount || 0), 0);
            const totalCommission = zoneAgents.reduce((sum, a) => sum + (a.commission || 0), 0);
            
            report[zoneName] = {
                totalSales,
                totalWins,
                totalCommission,
                netProfit: totalSales - totalWins - totalCommission,
                agentsCount: zoneAgents.length,
                ticketsCount: zoneTickets.length
            };
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, report }));
        return;
    }
    
    // LIMITES DE BOULES
    if (url === '/api/number-limits' && req.method === 'GET') {
        let { data: limits, error } = await supabase
            .from('number_limits')
            .select('*');
        
        const limitsObj = {
            simple: { enabled: false, blockedNumbers: [] },
            three: { enabled: false, blockedNumbers: [] },
            five: { enabled: false, blockedNumbers: [] }
        };
        
        if (limits) {
            limits.forEach(l => {
                if (limitsObj[l.type]) {
                    limitsObj[l.type] = { enabled: l.enabled, blockedNumbers: l.blocked_numbers || [] };
                }
            });
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, limits: limitsObj }));
        return;
    }
    
    if (url === '/api/update-number-limits' && req.method === 'POST') {
        const body = await parseBody();
        const { type, enabled, blockedNumbers } = body;
        
        let { error } = await supabase
            .from('number_limits')
            .update({ enabled: enabled, blocked_numbers: blockedNumbers })
            .eq('type', type);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    // BLOQUER/DEBLOQUER AGENT
    if (url === '/api/toggle-agent-block' && req.method === 'PUT') {
        const body = await parseBody();
        const { agentId, block } = body;
        
        let { error } = await supabase
            .from('agents')
            .update({ is_blocked: block })
            .eq('id', agentId);
        
        if (error) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        }
        return;
    }
    
    // STATS AGENT
    if (url.startsWith('/api/agent-stats') && req.method === 'GET') {
        const agentId = parseInt(url.split('=')[1]);
        
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single();
        
        let { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('total_amount, win_amount, is_winner, is_cancelled')
            .eq('agent_id', agentId)
            .eq('is_cancelled', false);
        
        const totalSales = (tickets || []).reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const totalWins = (tickets || []).filter(t => t.is_winner).reduce((sum, t) => sum + (t.win_amount || 0), 0);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            stats: { 
                totalSales, 
                totalWins, 
                netProfit: totalSales - totalWins,
                commission: agent ? agent.commission || 0 : 0,
                balance: agent ? agent.balance || 0 : 0
            } 
        }));
        return;
    }
    
    // SUPERVISEURS
    if (url === '/api/supervisors' && req.method === 'GET') {
        let { data: supervisors, error } = await supabase
            .from('supervisors')
            .select('*');
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, supervisors: supervisors || [] }));
        return;
    }
    
    // CRÉER SUPERVISEUR
    if (url === '/api/create-supervisor' && req.method === 'POST') {
        const body = await parseBody();
        
        const newSupervisor = {
            username: body.username,
            password: body.password,
            prenom: body.prenom,
            nom: body.nom,
            zone: body.zone,
            is_active: true,
            carte_identite: body.carteIdentite,
            matricule_fiscale: body.matriculeFiscale,
            date_naissance: body.dateNaissance,
            date_inscription: new Date().toISOString(),
            commission: 0,
            total_zone_sales: 0
        };
        
        let { data: supervisor, error } = await supabase
            .from('supervisors')
            .insert([newSupervisor])
            .select()
            .single();
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    // TIRAGES
    if (url === '/api/save-drawing' && req.method === 'POST') {
        const body = await parseBody();
        const { drawingName, drawingNumber } = body;
        
        // Sauvegarder le tirage
        await supabase
            .from('drawings')
            .insert([{
                drawing_name: drawingName,
                drawing_number: drawingNumber,
                date: new Date().toISOString()
            }]);
        
        // Récupérer tous les tickets pour ce tirage
        let { data: tickets, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('drawing_name', drawingName)
            .eq('is_winner', false)
            .eq('is_cancelled', false);
        
        for (const ticket of (tickets || [])) {
            let totalWin = 0;
            const winItems = [];
            
            for (const item of (ticket.items || [])) {
                const { winAmount, winType } = calculateWin(item, drawingNumber);
                if (winAmount > 0) {
                    totalWin += winAmount;
                    winItems.push({ ...item, winAmount, winType });
                }
            }
            
            if (totalWin > 0) {
                // Mettre à jour le ticket
                await supabase
                    .from('tickets')
                    .update({
                        is_winner: true,
                        win_amount: totalWin,
                        win_items: winItems
                    })
                    .eq('id', ticket.id);
                
                // Mettre à jour l'agent
                let { data: agent } = await supabase
                    .from('agents')
                    .select('balance')
                    .eq('id', ticket.agent_id)
                    .single();
                
                await supabase
                    .from('agents')
                    .update({ balance: (agent?.balance || 0) - totalWin })
                    .eq('id', ticket.agent_id);
                
                // Ajouter transaction
                await supabase
                    .from('transactions')
                    .insert([{
                        type: 'gain',
                        agent_id: ticket.agent_id,
                        ticket_id: ticket.id,
                        amount: totalWin,
                        date: new Date().toISOString(),
                        description: `Gain sur ticket ${ticket.id} - ${totalWin} GDS`
                    }]);
            }
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    if (url === '/api/drawings' && req.method === 'GET') {
        let { data: drawings, error } = await supabase
            .from('drawings')
            .select('*')
            .order('date', { ascending: false });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, drawings: drawings || [] }));
        return;
    }
    
    // TICKETS PAR STATUT
    if (url === '/api/tickets/by-status' && req.method === 'GET') {
        let { data: tickets, error } = await supabase
            .from('tickets')
            .select('*');
        
        const now = new Date();
        const threeMonthsAgo = new Date(now.setMonth(now.getMonth() - 3));
        
        const winningTickets = (tickets || []).filter(t => t.is_winner && !t.is_cancelled);
        const pendingTickets = (tickets || []).filter(t => !t.is_winner && !t.is_cancelled && !t.is_paid);
        const expiredTickets = (tickets || []).filter(t => !t.is_winner && !t.is_cancelled && new Date(t.date) < threeMonthsAgo);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            winning: winningTickets,
            pending: pendingTickets,
            expired: expiredTickets
        }));
        return;
    }
    
    // Route par défaut
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: "Route non trouvée" }));
});

const PORT = process.env.PORT || 3000;

// Démarrer le serveur localement
if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`✅ Serveur Borlette avec Supabase actif sur port: ${PORT}`);
    });
}

module.exports = server;