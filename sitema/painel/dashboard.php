<?php

session_start();
include 'includes/conexao.php';
include 'includes/auth.php';



/*
|--------------------------------------------------------------------------
| AJAX - VERIFICAR ULTIMO PEDIDO PARA SOM
|--------------------------------------------------------------------------
*/

if(isset($_GET['ajax_ultimo_pedido'])){

    $ultimo = $conn->query("SELECT MAX(id) ultimo FROM pedidos WHERE DATE(criado_em) = CURDATE()")->fetch_assoc();

    header('Content-Type: application/json');
    echo json_encode([
        'ultimo' => intval($ultimo['ultimo'] ?? 0)
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| AJAX - VERIFICAR STATUS DA LOJA
|--------------------------------------------------------------------------
*/

if(isset($_GET['ajax_status_loja'])){

    $statusLoja = $_SESSION['loja_aberta'] ?? false;

    header('Content-Type: application/json');
    echo json_encode([
        'aberta' => $statusLoja
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| ALTERAR STATUS DA LOJA
|--------------------------------------------------------------------------
*/

if(isset($_GET['toggle_loja'])){

    $statusAtual = $_SESSION['loja_aberta'] ?? false;
    $_SESSION['loja_aberta'] = !$statusAtual;
    
    if($_SESSION['loja_aberta']){
        $_SESSION['abertura_loja'] = date('Y-m-d H:i:s');
    }

    header('Content-Type: application/json');
    echo json_encode([
        'aberta' => $_SESSION['loja_aberta']
    ]);
    exit;
}

/*
|--------------------------------------------------------------------------
| CARDS - DASHBOARD
|--------------------------------------------------------------------------
*/

$clientes = $conn->query("
SELECT COUNT(*) total
FROM clientes
")->fetch_assoc();

$produtos = $conn->query("
SELECT COUNT(*) total
FROM produtos
")->fetch_assoc();

$categorias = $conn->query("
SELECT COUNT(*) total
FROM categorias
")->fetch_assoc();

$pedidosHoje = $conn->query("
SELECT COUNT(*) total
FROM pedidos
WHERE DATE(criado_em)=CURDATE()
")->fetch_assoc();

// CORRIGIDO: Faturamento pega TODOS os pedidos do dia (todos os status)
$faturamento = $conn->query("
SELECT COALESCE(SUM(total),0) total
FROM pedidos
WHERE DATE(criado_em)=CURDATE()
")->fetch_assoc();

// Status da loja
$lojaAberta = $_SESSION['loja_aberta'] ?? false;

/*
|--------------------------------------------------------------------------
| ULTIMOS PEDIDOS
|--------------------------------------------------------------------------
*/

// Se a loja estiver aberta, mostra apenas pedidos de hoje
// Se fechada, nao mostra nenhum
$wherePedidos = "";
if($lojaAberta){
    $wherePedidos = "WHERE DATE(p.criado_em) = CURDATE()";
} else {
    $wherePedidos = "WHERE 1=0";
}

$ultimosPedidos = $conn->query("
SELECT
p.id,
p.total,
p.status,
p.criado_em,
c.nome
FROM pedidos p
LEFT JOIN clientes c ON c.id = p.cliente_id
$wherePedidos
ORDER BY p.id DESC
LIMIT 10
");

?>

<!DOCTYPE html>
<html lang="pt-br">

<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>Dashboard</title>

<link rel="stylesheet" href="assets/css/style.css">

<style>

.cards{
    display:grid;
    grid-template-columns: repeat(auto-fit,minmax(220px,1fr));
    gap:20px;
    margin-bottom:30px;
}

.card{
    background:#fff;
    border-radius:15px;
    padding:25px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.card h4{
    color:#777;
    margin-bottom:10px;
}

.card h2{
    color:#111;
    font-size:30px;
}

.table-box{
    background:#fff;
    border-radius:15px;
    padding:25px;
    box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.table-box h3{
    margin-bottom:20px;
}

.status{
    padding:5px 10px;
    border-radius:20px;
    font-size:12px;
    font-weight:bold;
}

.AGUARDANDO_PAGAMENTO{
    background:#fff3cd;
}

.PAGO{
    background:#d4edda;
}

.EM_PREPARO{
    background:#cfe2ff;
}

.PRONTO{
    background:#cff4fc;
}

.SAIU_ENTREGA{
    background:#e2e3e5;
}

.ENTREGUE{
    background:#d1e7dd;
}

.CANCELADO{
    background:#f8d7da;
}

/* ===== CONTROLES TOPO ===== */
.top-controls {
    display: flex;
    gap: 15px;
    align-items: center;
    margin-bottom: 25px;
    flex-wrap: wrap;
}

.btn-loja {
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 16px;
    min-width: 120px;
}

.btn-loja.abrir {
    background: #28a745;
    color: white;
}

.btn-loja.abrir:hover {
    background: #218838;
}

.btn-loja.fechar {
    background: #dc3545;
    color: white;
}

.btn-loja.fechar:hover {
    background: #c82333;
}

.btn-som {
    padding: 12px 20px;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 16px;
    background: #6c757d;
    color: white;
    min-width: 140px;
}

.btn-som.ativo {
    background: #007bff;
}

.btn-som.ativo:hover {
    background: #0056b3;
}

.status-loja {
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: bold;
    font-size: 14px;
}

.status-loja.aberta {
    background: #d4edda;
    color: #155724;
}

.status-loja.fechada {
    background: #f8d7da;
    color: #721c24;
}

.loja-fechada-banner {
    background: #f8d7da;
    color: #721c24;
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    margin-bottom: 20px;
    border: 2px solid #f5c6cb;
}

.info-expediente {
    background: #cce5ff;
    color: #004085;
    padding: 15px 20px;
    border-radius: 10px;
    text-align: center;
    margin-bottom: 20px;
    border: 2px solid #b8daff;
}

.notificacao-pedido {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #ff6b00;
    color: white;
    padding: 20px 30px;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 9999;
    animation: slideIn 0.5s ease-out;
    font-size: 18px;
    font-weight: bold;
    max-width: 400px;
}

@keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
}

table {
    width: 100%;
    border-collapse: collapse;
}

table th {
    text-align: left;
    padding: 12px;
    border-bottom: 2px solid #eee;
    color: #555;
}

table td {
    padding: 12px;
    border-bottom: 1px solid #f0f0f0;
}

table tr:hover {
    background: #f8f9fa;
}

</style>

</head>

<body>

<?php include 'includes/sidebar.php'; ?>

<div class="main">

<?php include 'includes/topbar.php'; ?> <br> <br><br><br>





<!-- ===== CARDS ===== -->
<div class="cards">

    <div class="card">
        <h4>Pedidos Hoje</h4>
        <h2><?= $pedidosHoje['total']; ?></h2>
    </div>

    <div class="card">
        <h4>Faturamento Hoje</h4>
        <h2>R$ <?= number_format($faturamento['total'],2,',','.'); ?></h2>
    </div>

    <div class="card">
        <h4>Clientes</h4>
        <h2><?= $clientes['total']; ?></h2>
    </div>

    <div class="card">
        <h4>Produtos</h4>
        <h2><?= $produtos['total']; ?></h2>
    </div>

    <div class="card">
        <h4>Categorias</h4>
        <h2><?= $categorias['total']; ?></h2>
    </div>

</div>

<!-- ===== ULTIMOS PEDIDOS ===== -->
<div class="table-box">

    <h3>Ultimos Pedidos</h3>

    <table>
        <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Total</th>
            <th>Status</th>
            <th>Data</th>
        </tr>

        <?php if($ultimosPedidos && $ultimosPedidos->num_rows > 0){ ?>
            <?php while($pedido = $ultimosPedidos->fetch_assoc()){ ?>
            <tr>
                <td>#<?= $pedido['id']; ?></td>
                <td><?= $pedido['nome'] ?? 'Cliente'; ?></td>
                <td>R$ <?= number_format($pedido['total'],2,',','.'); ?></td>
                <td>
                    <span class="status <?= $pedido['status']; ?>">
                        <?= $pedido['status']; ?>
                    </span>
                </td>
                <td><?= date('d/m/Y H:i', strtotime($pedido['criado_em'])); ?></td>
            </tr>
            <?php } ?>
        <?php }else{ ?>
            <tr>
                <td colspan="5" style="text-align:center; padding:30px; color:#999;">
                    <?= $lojaAberta ? 'Nenhum pedido encontrado para o expediente atual.' : 'Abra a loja para visualizar os pedidos.' ?>
                </td>
            </tr>
        <?php } ?>
    </table>

</div>

</div>

</div>

<script>
// ============================================================
// FUNCOES DE SOM
// ============================================================

function beep() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        
        setTimeout(function() {
            osc.stop();
            ctx.close();
        }, 500);
        
    } catch(e) {
        try {
            const audio = new Audio('assets/audio/novo-pedido.mp3');
            audio.volume = 1;
            audio.play();
        } catch(e2) {}
    }
}

function tocarAlertaPersonalizado() {
    if (!somAtivado) return;
    
    // Toca 1 vez
    beep();
    
    // Pisca 2 vezes
    setTimeout(function() {
        piscarAlertaVisual();
    }, 500);
    
    setTimeout(function() {
        piscarAlertaVisual();
    }, 1500);
    
    // Toca mais 1 vez
    setTimeout(function() {
        beep();
    }, 2500);
}

function piscarAlertaVisual() {
    // Efeito visual no dashboard
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        card.style.transition = 'all 0.1s ease';
        card.style.transform = 'scale(1.03)';
        card.style.boxShadow = '0 0 30px rgba(255, 107, 0, 0.3)';
        setTimeout(() => {
            card.style.transform = 'scale(1)';
            card.style.boxShadow = '';
        }, 300);
    });
}

function mostrarNotificacao(pedidoId) {
    const notificacao = document.createElement('div');
    notificacao.className = 'notificacao-pedido';
    notificacao.innerHTML = `
        <strong>NOVO PEDIDO!</strong><br>
        Pedido #${pedidoId} acabou de chegar!
    `;
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        if (notificacao.parentNode) {
            notificacao.remove();
        }
    }, 5000);
}

// ============================================================
// VARIAVEIS
// ============================================================

let lojaAberta = <?= $lojaAberta ? 'true' : 'false' ?>;
let somAtivado = localStorage.getItem('somAtivado') === '1';
let ultimoPedido = 0;

// ============================================================
// CONTROLES
// ============================================================

async function toggleLoja() {
    try {
        const response = await fetch('dashboard.php?toggle_loja=1');
        const data = await response.json();
        location.reload();
    } catch(error) {
        console.error('Erro ao alternar loja:', error);
    }
}

function toggleSom() {
    const btnSom = document.getElementById('btnSom');
    somAtivado = !somAtivado;
    localStorage.setItem('somAtivado', somAtivado ? '1' : '0');
    
    if (somAtivado) {
        btnSom.textContent = 'Som Ativado';
        btnSom.className = 'btn-som ativo';
        beep();
    } else {
        btnSom.textContent = 'Som Desativado';
        btnSom.className = 'btn-som';
    }
}

// ============================================================
// VERIFICAR NOVOS PEDIDOS
// ============================================================

async function verificarNovosPedidos() {
    try {
        const resposta = await fetch('dashboard.php?ajax_ultimo_pedido=1');
        const dados = await resposta.json();
        const atual = parseInt(dados.ultimo || 0);
        
        if (ultimoPedido === 0) {
            ultimoPedido = atual;
            return;
        }
        
        if (atual > ultimoPedido && lojaAberta) {
            ultimoPedido = atual;
            
            // Tocar alerta
            tocarAlertaPersonalizado();
            
            // Mostrar notificacao
            mostrarNotificacao(atual);
            
            // Recarregar apos 2 segundos
            setTimeout(function() {
                location.reload();
            }, 2000);
        }
    } catch(e) {
        console.log('Erro ao verificar:', e);
    }
}

// ============================================================
// INICIALIZACAO
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Configurar botao de som
    const btnSom = document.getElementById('btnSom');
    if (somAtivado) {
        btnSom.textContent = 'Som Ativado';
        btnSom.className = 'btn-som ativo';
    } else {
        btnSom.textContent = 'Som Desativado';
        btnSom.className = 'btn-som';
    }
    
    // Pegar ultimo pedido
    <?php if($ultimosPedidos && $ultimosPedidos->num_rows > 0){ ?>
        <?php $ultimosPedidos->data_seek(0); ?>
        ultimoPedido = <?= $ultimosPedidos->fetch_assoc()['id'] ?? 0 ?>;
    <?php } ?>
    
    // Iniciar verificacao
    setInterval(verificarNovosPedidos, 5000);
    
    // Verificar status da loja
    setInterval(async function() {
        try {
            const response = await fetch('dashboard.php?ajax_status_loja=1');
            const data = await response.json();
            if (data.aberta !== lojaAberta) {
                location.reload();
            }
        } catch(e) {}
    }, 10000);
});
</script>

</body>

</html>