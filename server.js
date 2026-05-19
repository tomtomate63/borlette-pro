// server.js - Version Supabase avec PWA (CORRIGÉE - Version finale)
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
    
    if (req.method === 'OPTIONS') { 
        res.writeHead(200); 
        res.end(); 
        return; 
    }
    
    const url = req.url;
    
    // ==================== FICHIERS STATIQUES ====================
    if (url.startsWith('/agent-app/')) {
        let filePath = path.join(__dirname, 'agent-app', url.replace('/agent-app/', ''));
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
    // Route pour caissier-app - AJOUTÉ LE 17/05/2026
        // Servir caissier-app
    if (url.startsWith('/caissier-app/')) {
        let filePath = path.join(__dirname, 'caissier-app', url.replace('/caissier-app/', ''));
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
        let filePath = path.join(__dirname, 'admin-app', url.replace('/admin-app/', ''));
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
    
    if (url === '/manifest.json') {
        let filePath = path.join(__dirname, 'manifest.json');
        serveStaticFile(filePath, res, 'application/json');
        return;
    }
    
    if (url === '/sw.js') {
        let filePath = path.join(__dirname, 'sw.js');
        serveStaticFile(filePath, res, 'application/javascript');
        return;
    }
    
    if (url.startsWith('/icon/')) {
        let filePath = path.join(__dirname, url);
        const ext = path.extname(filePath);
        let contentType = 'image/png';
        if (ext === '.ico') contentType = 'image/x-icon';
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
    
    // ==================== SÉCURITÉ - VALIDATION CODE PIN ====================
    if (url === '/api/verify-pos-pin' && req.method === 'POST') {
        const body = await parseBody();
        let { pinCode, deviceId, posName } = body;
        
        if (pinCode) {
            pinCode = pinCode.replace(/-/g, '').replace(/\s/g, '');
        }
        
        console.log('Vérification PIN:', pinCode, 'Device:', deviceId);
        
        let { data: validPin, error } = await supabase
            .from('pos_pins')
            .select('*')
            .eq('pin_code', pinCode)
            .eq('is_active', true)
            .single();
        
        if (validPin) {
            await supabase
                .from('authorized_devices')
                .upsert({ 
                    device_id: deviceId,
                    pos_name: posName || validPin.pos_name,
                    pin_code: pinCode,
                    last_seen: new Date().toISOString(),
                    is_active: true
                });
            
            await supabase
                .from('pos_pins')
                .update({ last_used: new Date().toISOString(), used_count: (validPin.used_count || 0) + 1 })
                .eq('id', validPin.id);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                message: 'POS autorisé',
                posName: validPin.pos_name,
                zone: validPin.zone
            }));
        } else {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Code PIN invalide ou inactif' }));
        }
        return;
    }
    
    // Vérifier si un appareil est autorisé
    if (url === '/api/check-device' && req.method === 'POST') {
        const body = await parseBody();
        const { deviceId } = body;
        
        let { data: device, error } = await supabase
            .from('authorized_devices')
            .select('*')
            .eq('device_id', deviceId)
            .eq('is_active', true)
            .single();
        
        if (device) {
            await supabase
                .from('authorized_devices')
                .update({ last_seen: new Date().toISOString() })
                .eq('device_id', deviceId);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, authorized: true, posName: device.pos_name }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, authorized: false }));
        }
        return;
    }
    
    // LOGIN
    if (url === '/api/login' && req.method === 'POST') {
        const body = await parseBody();
        const { username, password } = body;
        
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('*')
            .eq('username', username)
            .eq('password', password);
        
        let user = agents && agents.length > 0 ? agents[0] : null;
        let isSupervisor = false;
        
        if (!user) {
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
            const isAdmin = user.is_admin === true || user.username === 'admin' || user.type === 'admin';
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                success: true, 
                user: { 
                    id: user.id, 
                    username: user.username, 
                    name: user.agent_name || `${user.prenom || ''} ${user.nom || ''}`.trim() || user.name,
                    agentName: user.agent_name,
                    zone: user.zone,
                    isAdmin: isAdmin,
                    is_admin: user.is_admin,
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
        
        const newTotalSales = (agent.total_sales || 0) + totalAmount;
        const newBalance = (agent.balance || 0) + totalAmount;
        const newCommission = (agent.commission || 0) + totalAmount * 0.05;
        
        await supabase
            .from('agents')
            .update({
                total_sales: newTotalSales,
                balance: newBalance,
                commission: newCommission
            })
            .eq('id', agentId);
        
        await supabase
            .from('transactions')
            .insert([{
                type: 'vente',
                agent_id: agentId,
                agent_name: agent.agent_name || `${agent.prenom} ${agent.nom}`,
                zone: agent.zone,
                amount: totalAmount,
                ticket_id: ticketId,
                previous_balance: agent.balance || 0,
                new_balance: newBalance,
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
        
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', ticket.agent_id)
            .single();
        
        if (agent) {
            const newTotalSales = (agent.total_sales || 0) - ticket.total_amount;
            const newBalance = (agent.balance || 0) - ticket.total_amount;
            const newCommission = (agent.commission || 0) - ticket.total_amount * 0.05;
            
            await supabase
                .from('agents')
                .update({
                    total_sales: newTotalSales,
                    balance: newBalance,
                    commission: newCommission
                })
                .eq('id', agent.id);
        }
        
        await supabase
            .from('tickets')
            .update({
                is_cancelled: true,
                cancelled_at: new Date().toISOString(),
                cancel_reason: reason || 'Annulation'
            })
            .eq('id', ticketId);
        
        await supabase
            .from('transactions')
            .insert([{
                type: 'annulation',
                agent_id: ticket.agent_id,
                agent_name: agent ? agent.agent_name : 'Inconnu',
                zone: agent ? agent.zone : 'Inconnu',
                amount: -ticket.total_amount,
                ticket_id: ticketId,
                previous_balance: agent ? agent.balance : 0,
                new_balance: agent ? (agent.balance - ticket.total_amount) : 0,
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
        
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('id, agent_name, zone');
        
        const agentsMap = {};
        if (agents) {
            agents.forEach(a => {
                agentsMap[a.id] = a;
            });
        }
        
        const ticketsWithAgent = (tickets || []).map(t => {
            const agent = agentsMap[t.agent_id];
            return {
                ...t,
                agentName: agent?.agent_name || 'Inconnu',
                zone: agent?.zone || 'Inconnu',
                isWinner: t.is_winner,
                isCancelled: t.is_cancelled,
                winAmount: t.win_amount,
                totalAmount: t.total_amount,
                drawingName: t.drawing_name,
                cancelledAt: t.cancelled_at,
                cancelReason: t.cancel_reason,
                isPaid: t.is_paid
            };
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, tickets: ticketsWithAgent }));
        return;
    }
    
    // TICKETS PAR STATUT
    if (url === '/api/tickets/by-status' && req.method === 'GET') {
        let { data: tickets, error } = await supabase
            .from('tickets')
            .select('*');
        
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        
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
    
    // PAYER TICKET
    if (url === '/api/pay-ticket' && req.method === 'POST') {
        const body = await parseBody();
        const { ticketId, paymentPointId } = body;
        
        let { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .select('*')
            .eq('id', ticketId)
            .single();
        
        if (!ticket) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Ticket non trouvé' }));
            return;
        }
        
        if (!ticket.is_winner) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Ce ticket n\'est pas gagnant' }));
            return;
        }
        
        if (ticket.is_paid) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Ce ticket a déjà été payé' }));
            return;
        }
        
        let { data: paymentPoint, error: pointError } = await supabase
            .from('payment_points')
            .select('*')
            .eq('id', paymentPointId)
            .single();
        
        if (!paymentPoint) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Point de paiement non trouvé' }));
            return;
        }
        
        if ((paymentPoint.balance || 0) < ticket.win_amount) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Solde insuffisant au point de paiement' }));
            return;
        }
        
        await supabase
            .from('tickets')
            .update({ 
                is_paid: true, 
                paid_at: new Date().toISOString(),
                paid_by_point: paymentPointId
            })
            .eq('id', ticketId);
        
        await supabase
            .from('payment_points')
            .update({ balance: (paymentPoint.balance || 0) - ticket.win_amount })
            .eq('id', paymentPointId);
        
        await supabase
            .from('transactions')
            .insert([{
                type: 'paiement_gagnant',
                ticket_id: ticketId,
                payment_point_id: paymentPointId,
                payment_point_name: paymentPoint.nom,
                amount: -ticket.win_amount,
                date: new Date().toISOString(),
                description: `Paiement du ticket gagnant ${ticketId} - ${ticket.win_amount} GDS`
            }]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Ticket marqué comme payé' }));
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
    
    // DASHBOARD FULL
    if (url === '/api/dashboard-full' && req.method === 'GET') {
        let { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('total_amount, win_amount, is_cancelled, is_winner');
        
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('commission');
        
        const totalSales = (tickets || []).filter(t => !t.is_cancelled).reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const totalWins = (tickets || []).filter(t => t.is_winner && !t.is_cancelled).reduce((sum, t) => sum + (t.win_amount || 0), 0);
        const totalCommission = (agents || []).reduce((sum, a) => sum + (a.commission || 0), 0);
        const netProfit = totalSales - totalWins - totalCommission;
        
        let { data: pettyCashData } = await supabase
            .from('petty_cash')
            .select('balance')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let pettyCashBalance = (pettyCashData && pettyCashData.length > 0) ? pettyCashData[0].balance : 0;
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            stats: { totalSales, totalWins, totalCommission, netProfit },
            pettyCash: { balance: pettyCashBalance }
        }));
        return;
    }
    
    // AGENTS
    if (url === '/api/agents' && req.method === 'GET') {
        let { data: agents, error } = await supabase
            .from('agents')
            .select('*')
            .neq('is_admin', true);
        
        let { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('agent_id, win_amount, is_winner, is_cancelled');
        
        const agentsWithWins = (agents || []).map(a => {
            const agentTickets = (tickets || []).filter(t => t.agent_id === a.id && !t.is_cancelled);
            const totalWins = agentTickets.filter(t => t.is_winner).reduce((sum, t) => sum + (t.win_amount || 0), 0);
            return { 
                ...a, 
                totalWins,
                totalSales: a.total_sales || 0,
                agentName: a.agent_name,
                isBlocked: a.is_blocked,
                balance: a.balance || 0,
                commission: a.commission || 0
            };
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, agents: agentsWithWins }));
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
            .eq('agent_id', agentId);
        
        const validTickets = (tickets || []).filter(t => !t.is_cancelled);
        const totalSales = validTickets.reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const totalWins = validTickets.filter(t => t.is_winner).reduce((sum, t) => sum + (t.win_amount || 0), 0);
        
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
            type: 'vendeur',
            is_admin: false
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
            res.end(JSON.stringify({ success: false, error: error.message }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        }
        return;
    }
    
    // SUPERVISEURS
    if (url === '/api/supervisors' && req.method === 'GET') {
        let { data: supervisors, error } = await supabase
            .from('supervisors')
            .select('*');
        
        const formattedSupervisors = (supervisors || []).map(s => ({
            id: s.id,
            username: s.username,
            prenom: s.prenom,
            nom: s.nom,
            zone: s.zone,
            isActive: s.is_active,
            carteIdentite: s.carte_identite,
            matriculeFiscale: s.matricule_fiscale,
            dateNaissance: s.date_naissance,
            dateInscription: s.date_inscription,
            commission: s.commission || 0,
            totalZoneSales: s.total_zone_sales || 0
        }));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, supervisors: formattedSupervisors }));
        return;
    }
    
    // CRÉER SUPERVISEUR
    if (url === '/api/create-supervisor' && req.method === 'POST') {
        const body = await parseBody();
        
        const { data: existing } = await supabase
            .from('supervisors')
            .select('id')
            .eq('username', body.username);
        
        if (existing && existing.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Nom d\'utilisateur déjà existant' }));
            return;
        }
        
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
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, supervisor }));
        return;
    }
    
    // ==================== POINTS DE PAIEMENT ====================
    if (url === '/api/payment-points' && req.method === 'GET') {
        let { data: paymentPoints, error } = await supabase
            .from('payment_points')
            .select('*')
            .order('id');
        
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('zone, total_sales');
        
        const salesByZone = {};
        (agents || []).forEach(a => {
            if (!salesByZone[a.zone]) salesByZone[a.zone] = 0;
            salesByZone[a.zone] += (a.total_sales || 0);
        });
        
        const formattedPoints = (paymentPoints || []).map(p => ({
            id: p.id,
            nom: p.nom,
            adresse: p.adresse,
            departement: p.departement,
            zone: p.zone,
            isActive: p.is_active,
            balance: (salesByZone[p.zone] || 0) + (p.balance || 0),
            balance_ventes: salesByZone[p.zone] || 0,
            balance_transferts: p.balance || 0,
            totalTransactions: p.total_transactions,
            dateCreation: p.date_creation
        }));
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, paymentPoints: formattedPoints }));
        return;
    }
    
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
        
        let { data: existingZone } = await supabase
            .from('zones')
            .select('name')
            .eq('name', body.zone);
        
        if (!existingZone || existingZone.length === 0) {
            await supabase.from('zones').insert([{ name: body.zone }]);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, paymentPoint: point }));
        return;
    }
    
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
    
    // DÉCHARGEMENT
    if (url === '/api/deposit' && req.method === 'POST') {
        const body = await parseBody();
        const { agentId, amount, paymentPointId, notes } = body;
        
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single();
        
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
        const pointPreviousBalance = paymentPoint.balance || 0;
        const pointNewBalance = pointPreviousBalance + amount;
        
        const { error: updateAgentError } = await supabase
            .from('agents')
            .update({ balance: newBalance })
            .eq('id', agentId);
        
        if (updateAgentError) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Erreur mise à jour agent' }));
            return;
        }
        
        const { error: updatePointError } = await supabase
            .from('payment_points')
            .update({ balance: pointNewBalance })
            .eq('id', paymentPointId);
        
        if (updatePointError) {
            await supabase.from('agents').update({ balance: previousBalance }).eq('id', agentId);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Erreur mise à jour point' }));
            return;
        }
        
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
        
        const fromPreviousBalance = fromPoint.balance || 0;
        const fromNewBalance = fromPreviousBalance - amount;
        const toPreviousBalance = toPoint.balance || 0;
        const toNewBalance = toPreviousBalance + amount;
        
        const { error: updateFromError } = await supabase
            .from('payment_points')
            .update({ balance: fromNewBalance })
            .eq('id', fromPointId);
        
        if (updateFromError) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Erreur mise à jour point source' }));
            return;
        }
        
        const { error: updateToError } = await supabase
            .from('payment_points')
            .update({ balance: toNewBalance })
            .eq('id', toPointId);
        
        if (updateToError) {
            await supabase.from('payment_points').update({ balance: fromPreviousBalance }).eq('id', fromPointId);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Erreur mise à jour point destination' }));
            return;
        }
        
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
                description: `Transfert de ${amount} GDS de ${fromPoint.nom} vers ${toPoint.nom}`,
                notes: notes
            }]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
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
    
    // RAPPORTS PAR ZONE
    if (url === '/api/reports/by-zone' && req.method === 'GET') {
        let { data: zones, error: zonesError } = await supabase
            .from('zones')
            .select('name');
        
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('id, zone, commission, total_sales');
        
        let { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('agent_id, total_amount, win_amount, is_winner, is_cancelled');
        
        const report = {};
        const zonesList = zones && zones.length > 0 ? zones : [...new Set((agents || []).map(a => a.zone).filter(z => z))];
        
        for (const zoneItem of zonesList) {
            const zoneName = typeof zoneItem === 'string' ? zoneItem : zoneItem.name;
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
        
        let { data: existing } = await supabase
            .from('number_limits')
            .select('id')
            .eq('type', type)
            .single();
        
        if (existing) {
            await supabase
                .from('number_limits')
                .update({ enabled: enabled, blocked_numbers: blockedNumbers })
                .eq('type', type);
        } else {
            await supabase
                .from('number_limits')
                .insert([{ type: type, enabled: enabled, blocked_numbers: blockedNumbers }]);
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    // TIRAGES
    if (url === '/api/save-drawing' && req.method === 'POST') {
        const body = await parseBody();
        const { drawingName, drawingNumber } = body;
        
        const { data: existing } = await supabase
            .from('drawings')
            .select('id')
            .eq('drawing_name', drawingName)
            .eq('drawing_number', drawingNumber);
        
        if (existing && existing.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Ce tirage a déjà été enregistré' }));
            return;
        }
        
        await supabase
            .from('drawings')
            .insert([{
                drawing_name: drawingName,
                drawing_number: drawingNumber,
                date: new Date().toISOString()
            }]);
        
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
                await supabase
                    .from('tickets')
                    .update({
                        is_winner: true,
                        win_amount: totalWin,
                        win_items: winItems
                    })
                    .eq('id', ticket.id);
                
                let { data: agent } = await supabase
                    .from('agents')
                    .select('balance')
                    .eq('id', ticket.agent_id)
                    .single();
                
                if (agent) {
                    await supabase
                        .from('agents')
                        .update({ balance: (agent.balance || 0) - totalWin })
                        .eq('id', ticket.agent_id);
                }
                
                await supabase
                    .from('transactions')
                    .insert([{
                        type: 'gain',
                        agent_id: ticket.agent_id,
                        ticket_id: ticket.id,
                        amount: -totalWin,
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
    
 
    
    if (url === '/api/petty-cash/balance' && req.method === 'GET') {
        let { data, error } = await supabase
            .from('petty_cash')
            .select('balance')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let balance = 0;
        if (data && data.length > 0) {
            balance = data[0].balance;
        } else {
            const { data: newData, error: insertError } = await supabase
                .from('petty_cash')
                .insert([{ balance: 0, created_at: new Date().toISOString() }])
                .select();
            if (newData && newData.length > 0) balance = newData[0].balance;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, balance: balance }));
        return;
    }
    
    if (url === '/api/petty-cash/transactions' && req.method === 'GET') {
        let { data: transactions, error } = await supabase
            .from('petty_cash_transactions')
            .select('*')
            .order('date', { ascending: false })
            .limit(100);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, transactions: transactions || [] }));
        return;
    }
    
    if (url === '/api/petty-cash/expense' && req.method === 'POST') {
        const body = await parseBody();
        const { amount, category, description, notes, adminName } = body;
        
        if (!amount || amount <= 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Montant invalide' }));
            return;
        }
        
        let { data: currentData } = await supabase
            .from('petty_cash')
            .select('balance')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let currentBalance = currentData && currentData.length > 0 ? currentData[0].balance : 0;
        let newBalance = currentBalance - amount;
        
        if (newBalance < 0 && !body.allowNegative) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Solde insuffisant' }));
            return;
        }
        
        await supabase
            .from('petty_cash')
            .insert([{ balance: newBalance, created_at: new Date().toISOString() }]);
        
        const transaction = {
            type: 'expense',
            amount: amount,
            category: category,
            description: description,
            notes: notes,
            admin_name: adminName || 'Admin',
            balance_after: newBalance,
            date: new Date().toISOString()
        };
        
        await supabase
            .from('petty_cash_transactions')
            .insert([transaction]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, newBalance: newBalance }));
        return;
    }
    
    if (url === '/api/petty-cash/transfer-to-payment-point' && req.method === 'POST') {
        const body = await parseBody();
        const { amount, paymentPointId, notes, adminName } = body;
        
        if (!amount || amount <= 0 || !paymentPointId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Données invalides' }));
            return;
        }
        
        let { data: cashData } = await supabase
            .from('petty_cash')
            .select('balance')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let currentBalance = cashData && cashData.length > 0 ? cashData[0].balance : 0;
        
        if (currentBalance < amount) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Solde petite caisse insuffisant' }));
            return;
        }
        
        let { data: paymentPoint } = await supabase
            .from('payment_points')
            .select('*')
            .eq('id', paymentPointId)
            .single();
        
        if (!paymentPoint) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Point de paiement non trouvé' }));
            return;
        }
        
        const newCashBalance = currentBalance - amount;
        const newPointBalance = (paymentPoint.balance || 0) + amount;
        
        await supabase
            .from('petty_cash')
            .insert([{ balance: newCashBalance, created_at: new Date().toISOString() }]);
        
        await supabase
            .from('payment_points')
            .update({ balance: newPointBalance })
            .eq('id', paymentPointId);
        
        const transaction = {
            type: 'transfer_to_payment_point',
            amount: amount,
            category: 'transfert',
            description: `Transfert vers ${paymentPoint.nom}`,
            notes: notes || `Alimentation du point ${paymentPoint.nom}`,
            admin_name: adminName || 'Admin',
            payment_point_id: paymentPointId,
            payment_point_name: paymentPoint.nom,
            balance_after: newCashBalance,
            date: new Date().toISOString()
        };
        
        await supabase
            .from('petty_cash_transactions')
            .insert([transaction]);
        
        await supabase
            .from('transactions')
            .insert([{
                type: 'alimentation_point',
                payment_point_id: paymentPointId,
                payment_point_name: paymentPoint.nom,
                amount: amount,
                date: new Date().toISOString(),
                description: `Alimentation du point ${paymentPoint.nom} depuis la petite caisse`
            }]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, newBalance: newCashBalance }));
        return;
    }
    
    if (url === '/api/petty-cash/topup' && req.method === 'POST') {
        const body = await parseBody();
        const { amount, source, notes, adminName } = body;
        
        if (!amount || amount <= 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Montant invalide' }));
            return;
        }
        
        let { data: currentData } = await supabase
            .from('petty_cash')
            .select('balance')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let currentBalance = currentData && currentData.length > 0 ? currentData[0].balance : 0;
        let newBalance = currentBalance + amount;
        
        await supabase
            .from('petty_cash')
            .insert([{ balance: newBalance, created_at: new Date().toISOString() }]);
        
        const transaction = {
            type: 'topup',
            amount: amount,
            category: 'rechargement',
            description: `Rechargement depuis ${source || 'ventes'}`,
            notes: notes,
            admin_name: adminName || 'Admin',
            balance_after: newBalance,
            date: new Date().toISOString()
        };
        
        await supabase
            .from('petty_cash_transactions')
            .insert([transaction]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, newBalance: newBalance }));
        return;
    }
    
    if (url === '/api/petty-cash/stats' && req.method === 'GET') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        
        let { data: transactions, error } = await supabase
            .from('petty_cash_transactions')
            .select('*')
            .gte('date', startOfMonth);
        
        let totalExpenses = 0;
        let totalTopups = 0;
        let totalTransfers = 0;
        
        (transactions || []).forEach(t => {
            if (t.type === 'expense') totalExpenses += t.amount;
            else if (t.type === 'topup') totalTopups += t.amount;
            else if (t.type === 'transfer_to_payment_point') totalTransfers += t.amount;
        });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            stats: {
                totalExpenses,
                totalTopups,
                totalTransfers,
                netChange: totalTopups - totalExpenses - totalTransfers
            }
        }));
        return;
    }
        // ==================== RENFLOUER LA PETITE CAISSE ====================
    if (url === '/api/petty-cash/topup-from-profit' && req.method === 'POST') {
        const body = await parseBody();
        const { amount, notes, adminName } = body;
        
        if (!amount || amount <= 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Montant invalide' }));
            return;
        }
        
        // Récupérer le bénéfice net actuel pour vérifier qu'il y a assez
        let { data: tickets, error: ticketsError } = await supabase
            .from('tickets')
            .select('total_amount, win_amount, is_cancelled, is_winner');
        
        let { data: agents, error: agentsError } = await supabase
            .from('agents')
            .select('commission');
        
        const totalSales = (tickets || []).filter(t => !t.is_cancelled).reduce((sum, t) => sum + (t.total_amount || 0), 0);
        const totalWins = (tickets || []).filter(t => t.is_winner && !t.is_cancelled).reduce((sum, t) => sum + (t.win_amount || 0), 0);
        const totalCommission = (agents || []).reduce((sum, a) => sum + (a.commission || 0), 0);
        const netProfit = totalSales - totalWins - totalCommission;
        
        if (amount > netProfit) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: `Montant supérieur au bénéfice net (${netProfit.toLocaleString()} GDS)` }));
            return;
        }
        
        // Récupérer le solde actuel de la petite caisse
        let { data: currentData } = await supabase
            .from('petty_cash')
            .select('balance')
            .order('created_at', { ascending: false })
            .limit(1);
        
        let currentBalance = currentData && currentData.length > 0 ? currentData[0].balance : 0;
        let newBalance = currentBalance + amount;
        
        // Mettre à jour le solde
        await supabase
            .from('petty_cash')
            .insert([{ balance: newBalance, created_at: new Date().toISOString() }]);
        
        // Enregistrer la transaction de renflouement
        await supabase
            .from('petty_cash_transactions')
            .insert([{
                type: 'topup_from_profit',
                amount: amount,
                category: 'renflouement',
                description: `Renflouement de la petite caisse depuis le bénéfice net`,
                notes: notes || `Renflouement par ${adminName || 'Admin'}`,
                admin_name: adminName || 'Admin',
                balance_after: newBalance,
                date: new Date().toISOString()
            }]);
        
        // Ajouter une trace dans les transactions principales
        await supabase
            .from('transactions')
            .insert([{
                type: 'renflouement_caisse',
                amount: -amount,
                date: new Date().toISOString(),
                description: `Renflouement de la petite caisse: ${amount.toLocaleString()} GDS`
            }]);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            newBalance: newBalance,
            netProfitRemaining: netProfit - amount,
            message: `✅ ${amount.toLocaleString()} GDS ajoutés à la petite caisse`
        }));
        return;
    }
    // ==================== GESTION DES PINS POS (ADMIN) ====================
    
    // GET - Récupérer tous les PINs
    if (url === '/api/pos-pins' && req.method === 'GET') {
        let { data: pins, error } = await supabase
            .from('pos_pins')
            .select('*')
            .order('id', { ascending: true });
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, pins: pins || [] }));
        return;
    }
    
    // POST - Créer un nouveau PIN
    if (url === '/api/pos-pins' && req.method === 'POST') {
        const body = await parseBody();
        const { pin_code, pos_name, zone } = body;
        
        if (!pin_code || !pos_name || !zone) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Tous les champs sont requis' }));
            return;
        }
        
        if (!/^\d{4,8}$/.test(pin_code)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Le PIN doit contenir 4 à 8 chiffres uniquement' }));
            return;
        }
        
        let { data: existing, error: existError } = await supabase
            .from('pos_pins')
            .select('id')
            .eq('pin_code', pin_code)
            .single();
        
        if (existing) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Ce code PIN existe déjà' }));
            return;
        }
        
        const newPin = {
            pin_code: pin_code,
            pos_name: pos_name,
            zone: zone,
            is_active: true,
            used_count: 0,
            created_at: new Date().toISOString(),
            last_modified: new Date().toISOString()
        };
        
        let { data: pin, error } = await supabase
            .from('pos_pins')
            .insert([newPin])
            .select()
            .single();
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, pin }));
        return;
    }
    
    // PUT - Modifier un PIN existant
    if (url.startsWith('/api/pos-pins/') && req.method === 'PUT' && !url.includes('/toggle')) {
        const id = parseInt(url.split('/')[3]);
        const body = await parseBody();
        const { pin_code, pos_name, zone, is_active } = body;
        
        if (!pin_code || !pos_name || !zone) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Tous les champs sont requis' }));
            return;
        }
        
        if (!/^\d{4,8}$/.test(pin_code)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Le PIN doit contenir 4 à 8 chiffres uniquement' }));
            return;
        }
        
        let { data: existing, error: existError } = await supabase
            .from('pos_pins')
            .select('id')
            .eq('pin_code', pin_code)
            .neq('id', id)
            .single();
        
        if (existing) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Ce code PIN existe déjà' }));
            return;
        }
        
        const updateData = {
            pin_code: pin_code,
            pos_name: pos_name,
            zone: zone,
            is_active: is_active !== undefined ? is_active : true,
            last_modified: new Date().toISOString()
        };
        
        let { error } = await supabase
            .from('pos_pins')
            .update(updateData)
            .eq('id', id);
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    // DELETE - Supprimer un PIN
    if (url.startsWith('/api/pos-pins/') && req.method === 'DELETE') {
        const id = parseInt(url.split('/')[3]);
        
        let { error } = await supabase
            .from('pos_pins')
            .delete()
            .eq('id', id);
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    // PUT - Activer/Désactiver un PIN
    if (url.startsWith('/api/pos-pins/') && url.includes('/toggle') && req.method === 'PUT') {
        const id = parseInt(url.split('/')[3]);
        const body = await parseBody();
        const { is_active } = body;
        
        let { error } = await supabase
            .from('pos_pins')
            .update({ is_active: is_active, last_modified: new Date().toISOString() })
            .eq('id', id);
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
    }
    
    // GET - Appareils autorisés
    if (url === '/api/authorized-devices' && req.method === 'GET') {
        let { data: devices, error } = await supabase
            .from('authorized_devices')
            .select('*')
            .order('last_seen', { ascending: false });
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, devices: devices || [] }));
        return;
    }
    
    // GET - Appareils non autorisés
    if (url === '/api/unauthorized-devices' && req.method === 'GET') {
        let { data: devices, error } = await supabase
            .from('authorized_devices')
            .select('*')
            .eq('is_active', false)
            .order('last_seen', { ascending: false });
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
            return;
        }
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, devices: devices || [] }));
        return;
    }
    
    // PUT - Bloquer/Débloquer un appareil
    if (url === '/api/block-device' && req.method === 'PUT') {
        const body = await parseBody();
        const { deviceId, is_active } = body;
        
        if (!deviceId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'deviceId requis' }));
            return;
        }
        
        let { error } = await supabase
            .from('authorized_devices')
            .update({ is_active: is_active })
            .eq('device_id', deviceId);
        
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: error.message }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        }
        return;
    }
        // ==================== TICKET GRATUIT POUR CLIENT ====================
    if (url === '/api/free-ticket' && req.method === 'POST') {
        const body = await parseBody();
        const { agentId, clientNom, clientPrenom, clientEmail, clientNif } = body;
        
        // Vérifier l'agent
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single();
        
        if (!agent || agent.is_blocked) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Agent non trouvé ou bloqué' }));
            return;
        }
        
        // Générer un numéro aléatoire à 5 chiffres
        const randomNumber = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        const ticketId = generateTicketId('FREE');
        
        const ticketData = {
            id: ticketId,
            agent_id: agentId,
            items: [{ number: randomNumber, amount: 0, ticketType: 'five' }],
            total_amount: 0,
            drawing_name: 'New York Midday',
            notes: `Ticket gratuit pour client: ${clientPrenom} ${clientNom}`,
            date: new Date().toISOString(),
            is_winner: false,
            win_amount: 0,
            win_items: [],
            is_cancelled: false,
            is_paid: false,
            client_nom: clientNom,
            client_prenom: clientPrenom,
            client_email: clientEmail,
            client_nif: clientNif,
            is_free_ticket: true
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
        
        // Enregistrer le client dans la table clients
        await supabase
            .from('clients')
            .upsert({
                nom: clientNom,
                prenom: clientPrenom,
                email: clientEmail,
                nif: clientNif,
                free_tickets_received: 1,
                last_purchase: new Date().toISOString().split('T')[0]
            }, { onConflict: 'email' });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            ticket: { id: ticketId, number: randomNumber },
            message: `Ticket gratuit offert ! Numéro: ${randomNumber}`
        }));
        return;
    }
        // ==================== TICKET GRATUIT POUR CLIENT ====================
    if (url === '/api/free-ticket' && req.method === 'POST') {
        const body = await parseBody();
        const { agentId, clientNom, clientPrenom, clientEmail, clientNif } = body;
        
        // Vérifier l'agent
        let { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('*')
            .eq('id', agentId)
            .single();
        
        if (!agent || agent.is_blocked) {
            res.writeHead(403, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Agent non trouvé ou bloqué' }));
            return;
        }
        
        // Générer un numéro aléatoire à 5 chiffres
        const randomNumber = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        const ticketId = generateTicketId('FREE');
        
        const ticketData = {
            id: ticketId,
            agent_id: agentId,
            items: [{ number: randomNumber, amount: 0, ticketType: 'five' }],
            total_amount: 0,
            drawing_name: 'New York Midday',
            notes: `Ticket gratuit pour client: ${clientPrenom} ${clientNom}`,
            date: new Date().toISOString(),
            is_winner: false,
            win_amount: 0,
            win_items: [],
            is_cancelled: false,
            is_paid: false,
            client_nom: clientNom,
            client_prenom: clientPrenom,
            client_email: clientEmail,
            client_nif: clientNif,
            is_free_ticket: true
        };
        
        // Sauvegarder le ticket
        let { data: ticket, error: ticketError } = await supabase
            .from('tickets')
            .insert([ticketData])
            .select()
            .single();
        
        if (ticketError) {
            console.error('Erreur ticket gratuit:', ticketError);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, message: 'Erreur sauvegarde ticket' }));
            return;
        }
        
        // Enregistrer le client dans la table clients
        await supabase
            .from('clients')
            .upsert({
                nom: clientNom,
                prenom: clientPrenom,
                email: clientEmail,
                nif: clientNif,
                free_tickets_received: 1,
                last_purchase: new Date().toISOString().split('T')[0]
            }, { onConflict: 'email' });
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            ticket: { id: ticketId, number: randomNumber },
            message: `Ticket gratuit offert ! Numéro: ${randomNumber}`
        }));
        return;
    }
    // ==================== ROUTE PAR DÉFAUT (404) ====================
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: "Route non trouvée" }));
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'production') {
    server.listen(PORT, () => {
        console.log(`✅ Serveur Borlette avec Supabase actif sur port: ${PORT}`);
    });
}

module.exports = server;